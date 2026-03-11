import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  Home,
  Shield,
  Clock,
  MapPin,
  Star,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const HomePage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const dashboardPath = user?.role === "admin" ? "/admin" : "/dashboard";

  const handleBrowseListings = () => {
    if (user) {
      navigate("/listings");
    } else {
      navigate("/login");
    }
  };

  const handleGetStarted = () => {
    if (loading) {
      return;
    }

    navigate(user ? dashboardPath : "/register");
  };

  const features = [
    {
      icon: Search,
      title: "Easy Search",
      description:
        "Find your perfect boarding house with advanced filters and search options",
    },
    {
      icon: Shield,
      title: "Verified Listings",
      description:
        "All listings are verified by our admin team for your safety and security",
    },
    {
      icon: Clock,
      title: "Quick Response",
      description:
        "Direct messaging with owners for fast communication and booking",
    },
    {
      icon: Star,
      title: "Trusted Reviews",
      description: "Read reviews from real students to make informed decisions",
    },
  ];

  const [stats, setStats] = React.useState([
    { number: "--", label: "Active Listings" },
    { number: "--", label: "Happy Students" },
    { number: "--", label: "Verified Owners" },
    { number: "--", label: "Satisfaction Rate" },
  ]);

  React.useEffect(() => {
    let mounted = true;
    import("../services/api").then(({ statsService }) => {
      statsService
        .getStats()
        .then((data) => {
          if (!mounted || !data) return;
          const formatted = [
            { number: `${data.activeListings}`, label: "Active Listings" },
            { number: `${data.happyStudents}`, label: "Happy Students" },
            { number: `${data.verifiedOwners}`, label: "Verified Owners" },
            { number: `${data.satisfactionRate}%`, label: "Satisfaction Rate" },
          ];
          setStats(formatted);
        })
        .catch((err) => {
          console.warn("Failed to load stats", err);
        });
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-primary-600 to-primary-800 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute transform rotate-45 -right-20 -top-20 w-96 h-96 bg-white rounded-full"></div>
          <div className="absolute transform -rotate-45 -left-20 -bottom-20 w-96 h-96 bg-white rounded-full"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
                Find Your Perfect
                <span className="block text-yellow-300">Boarding House</span>
              </h1>
              <p className="text-xl mb-8 text-gray-100">
                Connect with verified boarding houses near your campus. Safe,
                affordable, and convenient student housing made easy.
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handleBrowseListings}
                  className="btn-primary bg-white text-primary-600 hover:bg-gray-100"
                >
                  <Search className="inline h-5 w-5 mr-2" />
                  Browse Listings
                </button>
                <button
                  onClick={handleGetStarted}
                  disabled={loading}
                  className="btn-outline border-white text-white hover:bg-white hover:text-primary-600"
                >
                  Get Started
                  <ArrowRight className="inline h-5 w-5 ml-2" />
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="hidden md:block"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-yellow-300 rounded-3xl transform rotate-6"></div>
                <div className="relative bg-white rounded-3xl p-8 shadow-2xl">
                  <Home className="h-32 w-32 text-primary-600 mx-auto mb-4 animate-float" />
                  <h3 className="text-2xl font-bold text-gray-900 text-center mb-2">
                    Your Home Away From Home
                  </h3>
                  <p className="text-gray-600 text-center">
                    Comfortable, affordable, and safe boarding houses for
                    students
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-4xl font-bold text-primary-600 mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Choose Boarding Connect?
            </h2>
            <p className="text-xl text-gray-600">
              We make finding your perfect boarding house simple and secure
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="card p-6 text-center hover:shadow-2xl"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
                  <feature.icon className="h-8 w-8 text-primary-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600">
              Get started in three simple steps
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Create Account",
                description:
                  "Sign up as a student renter or boarding house owner in minutes",
              },
              {
                step: "02",
                title: "Search & Connect",
                description:
                  "Browse verified listings and message owners directly",
              },
              {
                step: "03",
                title: "Move In",
                description: "Confirm your booking and move into your new home",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="text-6xl font-bold text-primary-100 mb-4">
                  {item.step}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  {item.title}
                </h3>
                <p className="text-gray-600">{item.description}</p>
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ArrowRight className="h-8 w-8 text-primary-300" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold mb-6">
              Ready to Find Your New Home?
            </h2>
            <p className="text-xl mb-8 text-gray-100">
              Join thousands of students who have found their perfect boarding
              house
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={handleGetStarted}
                disabled={loading}
                className="btn-primary bg-white text-primary-600 hover:bg-gray-100"
              >
                {user ? "Go to Dashboard" : "Sign Up Now"}
              </button>
              <button
                onClick={handleBrowseListings}
                className="btn-outline border-white text-white hover:bg-white hover:text-primary-600"
              >
                Browse Listings
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HomePage;
