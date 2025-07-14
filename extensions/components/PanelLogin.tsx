import React, { useState } from "react"

import useAuth from "~hooks/useAuth"

export interface LoginForm {
  email: string
  password: string
}

export default function PanelLogin() {
  const [formData, setFormData] = useState<LoginForm>({
    email: null,
    password: null
  })

  const { handleLogin: onLogin, handleSignup: onSignup, error } = useAuth()

  const [mode, setMode] = useState<"login" | "signup">("login")

  const handleLogin = async () => {
    if (mode === "login") {
      await onLogin(formData)
    } else {
      await onSignup(formData)
    }
  }

  return (
    <div className="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <img
          className="mx-auto h-10 w-auto"
          src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=600"
          alt="Your Company"
        />
        <h2 className="mt-10 text-center text-2xl/9 font-bold tracking-tight text-gray-900">
          {mode === "login"
            ? "Sign in to your account"
            : "Sign up a new account"}
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <form className="space-y-6" action="#" onSubmit={handleLogin}>
          <div>
            <label
              htmlFor="email"
              className="block text-sm/6 font-medium text-gray-900">
              Email address
            </label>
            <div className="mt-2">
              <input
                type="email"
                name="email"
                id="email"
                required
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-sm/6 font-medium text-gray-900">
                Password
              </label>
              <div className="text-sm">
                <a
                  href="#"
                  className="font-semibold text-indigo-600 hover:text-indigo-500">
                  Forgot password?
                </a>
              </div>
            </div>
            <div className="mt-2">
              <input
                type="password"
                name="password"
                id="password"
                required
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
                className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
              {mode === "login" ? "Sign in" : "Sign up"}
            </button>
          </div>
        </form>

        {mode === "login" ? (
          <p className="mt-10 text-center text-sm/6 text-gray-500">
            Don't have an account?
            <a
              href="#"
              onClick={() => setMode("signup")}
              className="font-semibold text-indigo-600 hover:text-indigo-500">
              Sign up now!
            </a>
          </p>
        ) : (
          <p className="mt-10 text-center text-sm/6 text-gray-500">
            Already have an account?
            <a
              href="#"
              onClick={() => setMode("login")}
              className="font-semibold text-indigo-600 hover:text-indigo-500">
              Sign in now!
            </a>
          </p>
        )}
        {error && (
          <div className="text-red-600 text-sm p-2 bg-red-100 rounded-md">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
