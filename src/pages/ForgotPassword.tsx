import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
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
import { Loader2, ArrowLeft, MailCheck } from 'lucide-react';

const forgotSchema = z.object({
  email: z.string().email('Մուտքագրեք վավեր էլ․ հասցե'),
});

type ForgotValues = z.infer<typeof forgotSchema>;

const ForgotPassword = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const handleSubmit = async (values: ForgotValues) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        // Generic failure message: never reveal whether the address exists.
        toast({
          title: 'Չհաջողվեց ուղարկել նամակը',
          description: 'Փորձեք մի փոքր ուշ (Try again later)',
          variant: 'destructive',
        });
        return;
      }

      setSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <Card className="w-full max-w-md border-primary/20 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Գաղտնաբառի վերականգնում</CardTitle>
          <CardDescription>
            Մուտքագրեք ձեր էլ․ հասցեն՝ վերականգնման հղում ստանալու համար
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div
              className="flex flex-col items-center gap-3 py-4 text-center"
              data-testid="recovery-request-submitted"
            >
              <MailCheck className="h-10 w-10 text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                Եթե այս հասցեով հաշիվ գոյություն ունի, վերականգնման հղումն ուղարկված է։
                Ստուգեք ձեր փոստարկղը։
              </p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4" noValidate>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Էլ․ հասցե (Email)</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="example@mail.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full mt-6" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ուղարկել հղումը
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center border-t p-4">
          <Link
            to="/login"
            className="text-sm text-primary hover:underline font-medium inline-flex items-center"
          >
            <ArrowLeft className="mr-1 h-3 w-3" /> Վերադառնալ մուտքի էջ
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ForgotPassword;
