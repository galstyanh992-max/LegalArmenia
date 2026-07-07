import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { getSignInCandidates } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight } from 'lucide-react';
import logo from '@/assets/logo.png';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginValues = z.infer<typeof loginSchema>;

const Login = () => {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const navigate = useNavigate();
  const { signIn, user, loading: authLoading, isLoading: authIsLoading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const loginAttemptRef = useRef(0);
  const hasRedirected = useRef(false);

  const handleRedirect = useCallback(() => {
    if (hasRedirected.current) return;
    if (!user) return;
    hasRedirected.current = true;
    navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!authLoading && user && !hasRedirected.current) {
      handleRedirect();
    }
  }, [user, authLoading, handleRedirect]);

  useEffect(() => {
    if (loginSuccess && user && !authIsLoading && !hasRedirected.current) {
      const timer = setTimeout(() => {
        handleRedirect();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loginSuccess, user, authIsLoading, handleRedirect]);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const handleLogin = async (values: LoginValues) => {
    setIsLoading(true);
    setLoginSuccess(false);
    hasRedirected.current = false;
    loginAttemptRef.current += 1;
    const currentAttempt = loginAttemptRef.current;

    try {
      const candidates = getSignInCandidates(values.email);
      let result: Awaited<ReturnType<typeof signIn>> | null = null;
      let lastError: unknown;

      for (const candidate of candidates) {
        try {
          result = await signIn(candidate, values.password);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!result) {
        throw lastError instanceof Error ? lastError : new Error('Login failed');
      }
      
      if (result.user && currentAttempt === loginAttemptRef.current) {
        setLoginSuccess(true);
        setTimeout(() => {
          if (currentAttempt === loginAttemptRef.current && !hasRedirected.current) {
            hasRedirected.current = true;
            navigate('/dashboard', { replace: true });
          }
        }, 100);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const isConnectionIssue = /load failed|failed to fetch|network|timeout|connection terminated/i.test(message);

      toast({
        title: t('errors:login_failed', 'Login failed'),
        description: isConnectionIssue
          ? `${t('errors:connection_lost', 'Connection lost')}. ${t('errors:try_again', 'Try again')}`
          : message, // Show the actual message to help debug (e.g. "Email not confirmed")
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <Card className="w-full max-w-md border-primary/20 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/5 border border-primary/10 shadow-soft">
            <img src={logo} alt="Logo" className="h-12 w-12 object-contain drop-shadow-[0_2px_10px_rgba(215,180,106,0.3)]" />
          </div>
          <CardTitle className="text-2xl">Մուտք</CardTitle>
          <CardDescription>Մուտքագրեք ձեր տվյալները համակարգ մուտք գործելու համար</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Էլ․ հասցե (Email)</FormLabel>
                    <FormControl>
                      <Input type="text" autoComplete="email" placeholder="example@mail.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Գաղտնաբառ (Password)</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full mt-6" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Մուտք
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center border-t p-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Չունե՞ք հաշիվ:
            <Link to="/register" className="text-primary hover:underline font-medium inline-flex items-center">
              Գրանցվել <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
