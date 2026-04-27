import { Shield, Loader2 } from "lucide-react";

export function SplashScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 relative overflow-hidden">
      {/* Background accent lines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent"></div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent"></div>

      {/* Floating background elements */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-blue-100/20 dark:bg-blue-900/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-indigo-100/20 dark:bg-indigo-900/10 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center">
          {/* Logo Animation */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl mb-6 shadow-2xl animate-pulse">
            <Shield className="w-10 h-10 text-white" />
          </div>
          
          {/* Company Name */}
          <h1 className="text-5xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-200 bg-clip-text text-transparent mb-2">
            Gupio
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-xl font-medium mb-8">
          Intelligence & Analytics
          </p>
          
          {/* Loading Spinner */}
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-600 dark:text-indigo-400 animate-spin mr-3" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Initializing Intelligence & Analytics…</span>
          </div>
          
          {/* Loading Dots */}
          <div className="flex justify-center mt-4 space-x-1">
            <div className="w-2 h-2 bg-blue-600 dark:bg-indigo-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-600 dark:bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-600 dark:bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
} 