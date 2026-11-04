import { useFormik } from 'formik';
import React, { useContext, useState } from 'react';
import * as Yup from 'yup';
import { useRouter } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import GoogleButton from '@/components/GoogleButton';
import RoleSelector from '@/components/RoleSelector';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import dynamic from "next/dynamic";
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });
import otpAnimation from "../../public/Verification Code - OTP V2.json";

const SignUpPage = () => {
  const router = useRouter();
  const { initializing, signUp } = useContext(AuthContext);
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('EMPLOYEE');
  const { toast } = useToast();

  const handleSignUp = async (e: any) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { email, password } = formik.values;
      await signUp(email, password, selectedRole);
      router.push('/login');
    } catch (error: any) {
      console.error(error);
      
      // Check if it's a "user already registered" error
      if (error.code === 'user_already_exists' || 
          (error.message && error.message.includes('already registered'))) {
        toast({
          title: "Account exists",
          description: "This email is already registered. Please log in instead.",
        });
        // Redirect to login page after a short delay
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        toast({
          variant: "destructive",
          title: "Sign up failed",
          description: error.message || "Please try again.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  const validationSchema = Yup.object().shape({
    email: Yup.string().required("Email is required").email("Email is invalid"),
    password: Yup.string()
      .required("Password is required")
      .min(4, "Must be at least 4 characters")
      .max(40, "Must not exceed 40 characters"),
  });

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema,
    onSubmit: handleSignUp,
  });

  const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSignUp(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Animation Column - Hidden on small mobile but shown on larger mobile and desktop */}
        <div className="hidden sm:flex flex-col items-center justify-center lg:items-start space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="w-full max-w-[500px] h-auto aspect-square bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none p-6 border border-slate-100 dark:border-slate-800">
            <Lottie 
              animationData={otpAnimation} 
              loop={true} 
            />
          </div>
          <div className="text-center lg:text-left space-y-4 px-4 bg-primary/5 p-8 rounded-3xl border border-primary/10 max-w-[500px]">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Join the AttendX Network</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Empower your team with real-time tracking, seamless geofencing, and automated reporting. 
              Efficiency starts with professional attendance management.
            </p>
          </div>
        </div>

        {/* Signup Column */}
        <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
          <div className="w-full flex justify-center mb-2 flex-col items-center gap-4">
             <div className="text-center">
               <h1 className="text-3xl font-black tracking-tight mb-1 text-slate-900 dark:text-slate-100">Create Account</h1>
               <p className="text-sm text-muted-foreground font-medium">Get started with your AttendX workspace</p>
             </div>
          </div>

          <Card className="w-full md:w-[460px] border-none shadow-2xl shadow-slate-200/50 dark:shadow-black/20 rounded-[2.5rem] overflow-hidden bg-white dark:bg-slate-900" onKeyDown={handleKeyPress}>
            <CardHeader className="pb-2 pt-10">
              <CardTitle className="text-center text-xl font-bold">Sign Up</CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-10">
              <form onSubmit={handleSignUp} className="space-y-6">
                <div className="flex flex-col gap-4">
                  <GoogleButton />
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      router.push('/magic-link-login');
                    }}
                    variant="outline"
                    className="rounded-xl h-12 font-bold border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-sans"
                  >
                    Continue with Magic Link
                  </Button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white dark:bg-slate-900 px-4 text-xs font-bold uppercase tracking-widest text-muted-foreground/60">OR</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground pl-1">Email Address</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="name@company.com"
                      className="rounded-xl h-12 bg-slate-50 border-slate-100 dark:bg-slate-950 dark:border-slate-800 focus-visible:ring-primary focus-visible:ring-offset-0 transition-all"
                      value={formik.values.email}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    />
                    {formik.touched.email && formik.errors.email && (
                      <p className="text-red-500 text-[10px] font-bold mt-1 pl-1">{formik.errors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground pl-1">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPw ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="rounded-xl h-12 bg-slate-50 border-slate-100 dark:bg-slate-950 dark:border-slate-800 focus-visible:ring-primary focus-visible:ring-offset-0 transition-all"
                        value={formik.values.password}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-transparent"
                        onClick={() => setShowPw(!showPw)}
                      >
                        {showPw
                          ? <FaEye className="h-4 w-4 text-muted-foreground" />
                          : <FaEyeSlash className="h-4 w-4 text-muted-foreground" />
                        }
                      </Button>
                    </div>
                    {formik.touched.password && formik.errors.password && (
                      <p className="text-red-500 text-[10px] font-bold mt-1 pl-1">{formik.errors.password}</p>
                    )}
                  </div>

                  <div className="pt-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground pl-1 mb-2 block">Registering As</Label>
                    <RoleSelector 
                      selectedRole={selectedRole}
                      onChange={setSelectedRole}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01] transition-all disabled:opacity-50 disabled:hover:scale-100"
                    disabled={isLoading || initializing || !formik.values.email || !formik.values.password || !formik.isValid}
                    onClick={handleSignUp}
                  >
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>

                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <span>Already have an account?</span>
                      <Button
                        type="button"
                        variant="link"
                        className="p-0 h-auto font-bold text-primary hover:no-underline"
                        onClick={() => router.push('/login')}
                      >
                        Sign in instead
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
