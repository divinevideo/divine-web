import { useSeoMeta } from "@unhead/react";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-100 to-teal-100 dark:from-purple-950 dark:via-pink-950 dark:to-teal-950">
      <div className="text-center px-4 max-w-2xl mx-auto">
        {/* Divine Image */}
        <div className="mb-8 flex justify-center">
          <img
            src="/divine_gun.avif"
            alt="Divine"
            className="w-64 h-auto rounded-2xl shadow-2xl transform hover:scale-105 transition-transform duration-300 border-4 border-primary"
          />
        </div>

        {/* 404 Text */}
        <h1 className="text-8xl md:text-9xl font-bold mb-4 bg-gradient-to-r from-purple-600 via-pink-600 to-teal-600 bg-clip-text text-transparent animate-pulse">
          404
        </h1>

        {/* Campy Message */}
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
          This Page is <span className="text-primary font-pacifico">Divine</span>...ly Missing!
        </h2>

        <p className="text-xl text-muted-foreground mb-8">
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
    </div>
  );
};

export default NotFound;
