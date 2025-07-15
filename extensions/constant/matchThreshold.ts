export const MATCH_THRESHOLD = {
  LOW: 0.5,
  MEDIUM: 0.65,
  HIGH: 0.78
} as const

export type MatchThresholdValue =
  (typeof MATCH_THRESHOLD)[keyof typeof MATCH_THRESHOLD]

const getValue = (title, value) => ({ title, value })

export const matchThresholdOptions = [
  getValue("Thấp", MATCH_THRESHOLD.LOW),
  getValue("Trung bình", MATCH_THRESHOLD.MEDIUM),
  getValue("Cao", MATCH_THRESHOLD.HIGH)
]
