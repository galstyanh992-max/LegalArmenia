import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Scale, Shield, Brain, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import logo from '@/assets/logo.png';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: "easeOut" as const },
  }),
};

const Index = () => {
  const { t } = useTranslation(['common', 'disclaimer']);

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      {/* Header */}
      <header className="shrink-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="AI Legal Armenia" className="h-9 w-9 object-contain" />
            <h1 className="hidden text-lg font-bold tracking-tight sm:block">{t('common:app_name')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
            <Button asChild variant="outline" size="sm" className="rounded-full px-5">
              <Link to="/login">{t('common:login')}</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full px-5">
              <Link to="/register">{t('common:register', 'Register')}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative flex-1 overflow-y-auto">
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute top-20 right-0 h-[400px] w-[400px] rounded-full bg-primary/8 blur-3xl" />
          <div className="absolute -bottom-40 -left-20 h-[500px] w-[500px] rounded-full bg-accent/30 blur-3xl" />
        </div>

        <div className="container relative mx-auto px-4 py-8 sm:py-12 lg:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
              initial="hidden"
              animate="visible"
              custom={0}
              variants={fadeUp}
              className="mb-6 flex justify-center"
            >
              <div className="relative">
                <div className="absolute inset-0 scale-150 rounded-full bg-primary/10 blur-2xl" />
                <img
                  src={logo}
                  alt="AI Legal Armenia"
                  className="relative h-20 w-20 object-contain sm:h-28 sm:w-28"
                />
              </div>
            </motion.div>

            <motion.div
              initial="hidden"
              animate="visible"
              custom={1}
              variants={fadeUp}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t('common:ai_powered', 'AI-Powered Legal Platform')}
            </motion.div>

            <motion.h2
              initial="hidden"
              animate="visible"
              custom={2}
              variants={fadeUp}
              className="mb-5 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl"
            >
              {t('common:hero_title')}
            </motion.h2>

            <motion.p
              initial="hidden"
              animate="visible"
              custom={3}
              variants={fadeUp}
              className="mb-8 text-base text-muted-foreground sm:text-lg lg:text-xl leading-relaxed"
            >
              {t('common:hero_subtitle')}
            </motion.p>

            <motion.div
              initial="hidden"
              animate="visible"
              custom={4}
              variants={fadeUp}
              className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4"
            >
              <Button asChild size="lg" className="rounded-full px-8 text-base shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-shadow">
                <Link to="/register">
                  {t('common:get_started')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-8 text-base">
                <Link to="/login">
                  {t('common:login')}
                </Link>
              </Button>
            </motion.div>

            {/* Features */}
            <div className="mt-16 grid gap-5 sm:gap-6 md:grid-cols-3 lg:mt-24">
              {[
                { icon: Shield, key: 'roles' },
                { icon: Brain, key: 'analysis' },
                { icon: Scale, key: 'kb' },
              ].map((feature, i) => (
                <motion.div
                  key={feature.key}
                  initial="hidden"
                  animate="visible"
                  custom={5 + i}
                  variants={fadeUp}
                  className="group relative rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 sm:p-8 transition-all duration-500 hover:border-accent/40 hover:shadow-[0_8px_30px_rgba(215,180,106,0.12)] hover:-translate-y-1"
                >
                  <div className="mb-6 relative inline-flex items-center justify-center rounded-2xl p-4 bg-gradient-to-br from-[#F8EDB2] via-[#D7B46A] to-[#9E7728] shadow-[0_4px_20px_rgba(215,180,106,0.3)] group-hover:shadow-[0_8px_25px_rgba(215,180,106,0.5)] transition-all duration-500 transform group-hover:scale-110">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <feature.icon className="h-7 w-7 sm:h-8 sm:w-8 text-[#0F1423] relative z-10 drop-shadow-md" strokeWidth={1.5} />
                  </div>
                  <h3 className="mb-3 text-lg font-bold sm:text-xl group-hover:text-accent transition-colors duration-300">
                    {t(`common:feature_${feature.key}`)}
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {t(`common:feature_${feature.key}_desc`)}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Legal Disclaimer */}
            <motion.div
              initial="hidden"
              animate="visible"
              custom={8}
              variants={fadeUp}
              className="mt-12 rounded-xl border border-warning/30 bg-warning/5 p-4 sm:mt-16"
            >
              <p className="text-xs text-warning sm:text-sm">
                ⚠️ {t('disclaimer:main')}
              </p>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="shrink-0 border-t border-border/50 py-4">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground sm:text-sm">
          <p>{t('common:copyright')}</p>
          <p className="mt-2">{t('disclaimer:ra_data_law')}</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
