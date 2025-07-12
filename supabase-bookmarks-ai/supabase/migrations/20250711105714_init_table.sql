-- Kích hoạt tiện ích mở rộng vector nếu chưa có
CREATE EXTENSION IF NOT EXISTS vector;

-- Tạo bảng bookmarks
CREATE TABLE bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- ID duy nhất cho mỗi đánh dấu trang
    browser_bookmark_id bigint NOT null DEFAULT 0,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- ID người dùng để liên kết đánh dấu trang với người dùng cụ thể
    url TEXT NOT NULL UNIQUE, -- URL của trang được đánh dấu, đảm bảo duy nhất
    title TEXT, -- Tiêu đề của trang
    summary TEXT, -- Tóm tắt nội dung trang được tạo bởi AI
    key_info JSONB, -- Thông tin chính được trích xuất, lưu dưới dạng JSON
    embedding VECTOR(768), -- Vector nhúng của tóm tắt. Kích thước 768 là phổ biến cho các mô hình nhúng (ví dụ: Sentence Transformers). Bạn có thể điều chỉnh tùy theo mô hình bạn sử dụng.
    created_at TIMESTAMPTZ DEFAULT NOW() -- Thời gian tạo đánh dấu trang
);

-- Tùy chọn: Thêm chỉ mục để tăng tốc tìm kiếm vector
-- Chỉ mục IVFFlat là tốt cho các tập dữ liệu lớn và tìm kiếm láng giềng gần nhất (ANN)
CREATE INDEX ON bookmarks USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- Thêm chính sách bảo mật (RLS) để chỉ cho phép người dùng truy cập dữ liệu của họ
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bookmarks" ON bookmarks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookmarks" ON bookmarks
  FOR INSERT WITH CHECK (auth.uid()= user_id);

CREATE POLICY "Users can update their own bookmarks" ON bookmarks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks" ON bookmarks
  FOR DELETE USING (auth.uid() = user_id);


    -- Tạo hàm RPC để tìm kiếm các đánh dấu trang tương tự dựa trên vector nhúng
CREATE OR REPLACE FUNCTION match_bookmarks (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  user_id_param UUID
)
RETURNS TABLE (
  id uuid,
  url text,
  title text,
  summary text,
  key_info jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.url,
    b.title,
    b.summary,
    b.key_info,
    (b.embedding <#> query_embedding) * -1 AS similarity
  FROM bookmarks AS b
  WHERE
    b.user_id = user_id_param
    AND (b.embedding <#> query_embedding) * -1 >= match_threshold
  ORDER BY b.embedding <#> query_embedding
  LIMIT match_count;
END;
$$;


CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- ID duy nhất cho mỗi tag
    name TEXT NOT NULL UNIQUE, -- Tên của tag, đảm bảo duy nhất
    created_at TIMESTAMPTZ DEFAULT NOW() -- Thời gian tạo tag
);

-- Thêm chính sách bảo mật (RLS) cho bảng tags
-- Tags có thể được tạo bởi bất kỳ người dùng nào, nhưng chúng ta có thể thêm user_id nếu muốn tags là riêng tư cho từng người dùng
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- Cho phép người dùng xem tất cả các tags
CREATE POLICY "Users can view all tags" ON tags
  FOR SELECT USING (true);

-- Cho phép người dùng thêm tags mới
CREATE POLICY "Users can insert tags" ON tags
  FOR INSERT WITH CHECK (true); -- Hoặc auth.uid()::text = creator_user_id nếu bạn muốn tags thuộc về người tạo


CREATE TABLE bookmark_tags (
    bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE, -- Khóa ngoại đến bảng bookmarks
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE, -- Khóa ngoại đến bảng tags
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE , -- ID người dùng để đảm bảo RLS nhất quán
    PRIMARY KEY (bookmark_id, tag_id), -- Khóa chính kép để đảm bảo tính duy nhất của cặp bookmark-tag
    created_at TIMESTAMPTZ DEFAULT NOW() -- Thời gian tạo mối quan hệ
);

-- Thêm chính sách bảo mật (RLS) cho bảng bookmark_tags
ALTER TABLE bookmark_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bookmark_tags" ON bookmark_tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookmark_tags" ON bookmark_tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmark_tags" ON bookmark_tags
  FOR DELETE USING (auth.uid() = user_id);

-- Tạo hàm RPC để truy vấn các bookmark dựa trên tên tag
CREATE OR REPLACE FUNCTION get_bookmarks_by_tag_name (
  tag_name_param text,   -- Tên của tag muốn tìm kiếm
  user_id_param UUID     -- ID người dùng để lọc kết quả
)
RETURNS TABLE (
  id uuid,
  url text,
  title text,
  summary text,
  key_info jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.url,
    b.title,
    b.summary,
    b.key_info,
    b.created_at
  FROM bookmarks AS b
  JOIN bookmark_tags AS bt ON b.id = bt.bookmark_id
  JOIN tags AS t ON bt.tag_id = t.id
  WHERE t.name = tag_name_param
    AND (b.user_id = user_id_param); -- Đảm bảo chỉ trả về bookmark của người dùng hiện tại
END;
$$;