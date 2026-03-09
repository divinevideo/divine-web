import { useSeoMeta } from "@unhead/react";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AppPage, AppPageHeader } from "@/components/AppPage";

const NotFound = () => {
  const location = useLocation();

  useSeoMeta({
    title: "404 - Page Not Found",
    description: "The page you are looking for could not be found. Return to the home page to continue browsing.",
  });

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <AppPage
      width="detail"
      className="min-h-[calc(100vh-var(--app-header-height)-var(--app-bottom-nav-height)-var(--sat)-var(--sab))] flex items-center justify-center bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.16),_transparent_36%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))]"
    >
      <div className="app-surface w-full px-6 py-8 text-center sm:px-8 sm:py-10">
        <AppPageHeader
          eyebrow="404"
          title="This page drifted off the timeline"
          description="The route you asked for does not exist here anymore. Jump back into the app from a safer surface."
          className="mb-4"
        />
        {/* Divine Image */}
        <div className="mb-8 flex justify-center">
          <img
            src="/divine_gun.avif"
            alt="Divine"
            className="h-auto w-56 rounded-[28px] border-4 border-primary shadow-2xl transition-transform duration-300 hover:scale-105 sm:w-64"
          />
        </div>

        {/* 404 Text */}
        <h1 className="mb-4 bg-gradient-to-r from-brand-green via-primary to-brand-yellow bg-clip-text text-7xl font-bold text-transparent sm:text-8xl md:text-9xl">
          404
        </h1>

        {/* Campy Message */}
        <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
          This Page is <span className="text-primary font-pacifico">Divine</span>...ly Missing!
        </h2>

        <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
          Even icons take wrong turns sometimes ✨
        </p>

        {/* Return Button */}
        <Button
          asChild
          size="lg"
          className="bg-primary hover:brightness-110 text-white font-semibold px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all"
        >
          <a href="/">Get Me Outta Here!</a>
        </Button>
      </div>
    </AppPage>
  );
};

export default NotFound;
