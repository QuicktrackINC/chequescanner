import { login } from './actions'

export const dynamic = 'force-dynamic';

export default async function LoginPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const error = searchParams?.error as string | undefined;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 p-6 dark:bg-zinc-950">
      <div className="z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col items-center justify-center space-y-4 border-b border-gray-200 px-6 py-8 pt-10 text-center sm:px-20 dark:border-zinc-800">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Protected Access</h3>
          <p className="text-base text-gray-500 dark:text-gray-400">
            Sign in to access the dashboard
          </p>
        </div>
        <form action={login} className="flex flex-col space-y-5 px-6 py-10 sm:px-20">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-semibold uppercase text-gray-700 dark:text-gray-300"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="mt-2 block w-full appearance-none rounded-lg border border-gray-300 px-4 py-3 text-base placeholder-gray-400 shadow-sm focus:border-black focus:outline-none focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold uppercase text-gray-700 dark:text-gray-300"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-2 block w-full appearance-none rounded-lg border border-gray-300 px-4 py-3 text-base placeholder-gray-400 shadow-sm focus:border-black focus:outline-none focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
            />
          </div>
          
          {error && (
             <div className="text-base font-medium text-red-500 text-center">
               {decodeURIComponent(error)}
             </div>
          )}

          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center space-x-2 rounded-lg border border-transparent bg-black px-4 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 dark:bg-white dark:text-black dark:hover:bg-gray-200 dark:focus:ring-white dark:focus:ring-offset-zinc-900"
          >
            Sign In
          </button>
        </form>

        <div className="px-6 pb-4 sm:px-20">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500 dark:bg-zinc-900 dark:text-zinc-400">
                Or continue with
              </span>
            </div>
          </div>

          <div className="mt-4 pb-6">
            <a
              href="http://localhost:3000/api/tools/check-scanner/launch"
              className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 dark:focus:ring-white dark:focus:ring-offset-zinc-900"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded bg-orange-500 text-[10px] font-black text-white">
                Q
              </div>
              Login via QuickTrack Hub
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
