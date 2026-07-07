import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
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
import { Shield, Loader2, ArrowRight } from 'lucide-react';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterValues = z.infer<typeof registerSchema>;

const Register = () => {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const handleRegister = async (values: RegisterValues) => {
    setIsLoading(true);

    try {
      const data = await signUp(values.email, values.password, values.fullName);
      
      // If session is null, it means email confirmation is required
      if (data && typeof data === 'object' && 'user' in data && !('session' in data && data.session)) {
        toast({
          title: "Registration successful",
          description: "Please check your email to confirm your account before logging in.",
          variant: 'default',
        });
      } else {
        toast({
          title: "Registration successful",
          description: "Your account has been created successfully. You can now login.",
          variant: 'default',
        });
      }
      
      navigate('/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const isConnectionIssue = /load failed|failed to fetch|network|timeout|connection terminated/i.test(message);
      
      let errorDescription = 'Failed to create account. Please try again.';
      if (isConnectionIssue) {
        errorDescription = 'Connection lost. Try again.';
      } else if (message.includes('already registered') || message.includes('User already exists')) {
        errorDescription = 'This email is already registered. Please login instead.';
      }

      toast({
        title: "Registration failed",
        description: errorDescription,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <Card className="w-full max-w-md border-primary/20 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Գրանցում</CardTitle>
          <CardDescription>Ստեղծել նոր հաշիվ LegalArmenia համակարգում</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleRegister)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Անուն Ազգանուն</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="Արամ Արամյան" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Էլ․ հասցե (Email)</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" placeholder="example@mail.com" {...field} />
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
                        autoComplete="new-password"
                        placeholder="••••••••"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Հաստատել գաղտնաբառը</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
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
                Գրանցվել
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center border-t p-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Արդեն ունե՞ք հաշիվ:
            <Link to="/login" className="text-primary hover:underline font-medium inline-flex items-center">
              Մուտք <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Register;
