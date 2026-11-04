import { useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@/util/supabase/component";

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // If user is already logged in, redirect to dashboard
        router.push("/dashboard");
      } else {
        // Otherwise, redirect to login
        router.push("/login");
      }
    };

    checkUser();
  }, [router, supabase.auth]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Initializing AttendX...</p>
      </div>
    </div>
  );
}