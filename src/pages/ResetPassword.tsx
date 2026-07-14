import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { Loader2, ShieldCheck, LinkIcon } from 'lucide-react';

const passwordSchema = z
  .object({
    password: z.string().min(8, 'Գաղտնաբառը պետք է լինի առնվազն 8 նիշ'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Գաղտնաբառերը չեն համընկնում',
  });

type PasswordValues = z.infer<typeof passwordSchema>;

type Phase = 'checking' | 'ready' | 'invalid' | 'expired' | 'success';

/**
 * Reads recovery-link failure hints from the URL without touching tokens.
 * Supabase puts errors either in the hash fragment or the query string.
 */
function readUrlRecoveryError(): 'expired' | 'invalid' | null {
  const sources = [
    window.location.hash.replace(/^#/, ''),
    window.location.search.replace(/^\?/, ''),
  ];
  for (const source of sources) {
    const params = new URLSearchParams(source);
    if (params.get('error') || params.get('error_code')) {
      return params.get('error_code') === 'otp_expired' ? 'expired' : 'invalid';
    }
  }
  return null;
}

function urlLooksLikeRecoveryCallback(): boolean {
  const hash = window.location.hash;
  const search = window.location.search;
  return hash.includes('type=recovery') || search.includes('code=');
}

const RECOVERY_SESSION_TIMEOUT_MS = 8000;

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>('checking');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const urlError = readUrlRecoveryError();
    if (urlError) {
      setPhase(urlError);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'PASSWORD_RECOVERY' || (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION'))) {
        setPhase((prev) => (prev === 'checking' ? 'ready' : prev));
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (session) {
        setPhase((prev) => (prev === 'checking' ? 'ready' : prev));
      } else if (!urlLooksLikeRecoveryCallback()) {
        setPhase((prev) => (prev === 'checking' ? 'invalid' : prev));
      } else {
        // Token present in URL: give the client a bounded window to exchange it.
        timeout = setTimeout(() => {
          if (isMounted) {
            setPhase((prev) => (prev === 'checking' ? 'invalid' : prev));
          }
        }, RECOVERY_SESSION_TIMEOUT_MS);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  const handleUpdate = async (values: PasswordValues) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: values.password });

      if (error) {
        toast({
          title: 'Չհաջողվեց թարմացնել գաղտնաբառը',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      setPhase('success');
      // Recovery session must not stay elevated: force a clean re-login.
      await supabase.auth.signOut();
      toast({
        title: 'Գաղտնաբառը թարմացված է',
        description: 'Մուտք գործեք նոր գաղտնաբառով',
      });
      navigate('/login', { replace: true });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <Card className="w-full max-w-md border-primary/20 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Նոր գաղտնաբառ</CardTitle>
          <CardDescription>Սահմանեք ձեր հաշվի նոր գաղտնաբառը</CardDescription>
        </CardHeader>
        <CardContent>
          {phase === 'checking' && (
            <div
              className="flex items-center justify-center gap-2 py-6"
              role="status"
              data-testid="recovery-checking"
            >
              <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">Հղումը ստուգվում է…</span>
            </div>
          )}

          {(phase === 'invalid' || phase === 'expired') && (
            <div
              className="flex flex-col items-center gap-3 py-4 text-center"
              data-testid="recovery-link-invalid"
            >
              <LinkIcon className="h-10 w-10 text-destructive" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {phase === 'expired'
                  ? 'Վերականգնման հղումի ժամկետը լրացել է։ Խնդրում ենք պահանջել նոր հղում։'
                  : 'Վերականգնման հղումն անվավեր է կամ արդեն օգտագործվել է։'}
              </p>
              <Button asChild variant="outline">
                <Link to="/forgot-password">Պահանջել նոր հղում</Link>
              </Button>
            </div>
          )}

          {phase === 'success' && (
            <div
              className="flex flex-col items-center gap-3 py-4 text-center"
              data-testid="recovery-success"
            >
              <ShieldCheck className="h-10 w-10 text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Գաղտնաբառը հաջողությամբ թարմացվել է։</p>
            </div>
          )}

          {phase === 'ready' && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Նոր գաղտնաբառ</FormLabel>
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
                  name="confirm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Կրկնեք գաղտնաբառը</FormLabel>
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
                <Button type="submit" className="w-full mt-6" disabled={isUpdating}>
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Թարմացնել գաղտնաբառը
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center border-t p-4">
          <Link to="/login" className="text-sm text-primary hover:underline font-medium">
            Վերադառնալ մուտքի էջ
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ResetPassword;
