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

  const developers = [
    {
      name: "Philip Salvador Jr.",
      role: "Full-Stack Developer",
      image: "https://scontent.fcgm1-1.fna.fbcdn.net/v/t39.30808-6/559032842_2204099540086813_3137192340666141654_n.jpg?_nc_cat=103&ccb=1-7&_nc_sid=1d70fc&_nc_eui2=AeGE0ZCo8mLCXlfsFovD69dQRMy41p6UKNtEzLjWnpQo28Zlw-hJ0MgrcVu7ppJZ3YToV9_z2Q3We4GxH1vys65S&_nc_ohc=KzbU52LATuIQ7kNvwFW9Rx7&_nc_oc=Adp43M0b5Wm4P00q09aAxLuf1BXT7g1JNsFL0nCTn98morFxoLnTFBBwFwZJkARpeCA&_nc_zt=23&_nc_ht=scontent.fcgm1-1.fna&_nc_gid=Z-rtttXRIh5eNtPUxj8mFA&_nc_ss=7a2a8&oh=00_Af7xyugfOyMtJEJZE0LmNnLm7TgaQspBDs-01X0gCwOejQ&oe=6A01F125",
    },
    {
      name: "Earlyn Roxas",
      role: "Backend Developer",
      image:"https://scontent.fcgm1-1.fna.fbcdn.net/v/t39.30808-1/680003841_122284527104190117_5244835006335231736_n.jpg?stp=dst-jpg_s200x200_tt6&_nc_cat=109&ccb=1-7&_nc_sid=e99d92&_nc_eui2=AeG8S0v1zm3KQbKsGekkVT0Kc1hh8i2lWn5zWGHyLaVafudAgV6h6_DpNjNSJs7qEl0TIety7dfJ5VXzcyiorEIJ&_nc_ohc=aYHLz-NBdNwQ7kNvwESmLqO&_nc_oc=Adrum_ZfBZ06ySO56aLNDLt9l_TjL_80u29SiC4VN4b5lWHHtwOwO2Y7ZrzXTXSKtRc&_nc_zt=24&_nc_ht=scontent.fcgm1-1.fna&_nc_gid=qqefjHmvi7HtNeDdOwCOMQ&_nc_ss=7a2a8&oh=00_Af6TZBWIINcJSh2hR2Qd21uE04gh0Pcu8ny1TGbfl8Gxkw&oe=6A01E88B",
    },
    {
      name: "Ainnz Thryzen Yane",
      role: "UI/UX Developer",
      image: "",
    },
    {
      name: "Mary Jane Asequia",
      role: "Frontend Developer",
      image:
        "https://scontent.fceb3-1.fna.fbcdn.net/v/t1.15752-9/646404031_26029606929983383_6623342040773455225_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=9f807c&_nc_eui2=AeH5sI6ICUS3snBdb6yhCiKQ80tP_J4OAeDzS0_8ng4B4MDmwi4STxVEFxXx0imYLhLw849p5lu0cLVGuBpIG9wq&_nc_ohc=DjW5n8mPinEQ7kNvwHwMkgy&_nc_oc=AdqVgDQG2wxBSYpPU5ejJwFMQ5sEKefWEAZVwr00GSG4LAS9kUAHAgPcs2UURWXnudg&_nc_zt=23&_nc_ht=scontent.fceb3-1.fna&_nc_ss=7b2a8&oh=03_Q7cD5AG6MaAbvwRxdhzlVWIOf8MllNjTgCQWFNZ6yKj4S0AdLg&oe=6A17A562",
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

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mt-28 mb-10"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Developers
            </h2>
            <p className="text-xl text-gray-600">
              Meet the team behind Boarding Connect
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {developers.map((developer, index) => (
              <motion.div
                key={developer.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="rounded-2xl border border-yellow-200 bg-gradient-to-br from-yellow-50 via-yellow-100 to-yellow-200/80 p-6 text-center shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <img
                  src={developer.image}
                  alt={developer.name}
                  className="h-28 w-28 mx-auto rounded-full object-cover border-4 border-yellow-50 shadow-md ring-2 ring-yellow-300 mb-4"
                />
                <h3 className="text-lg font-bold text-gray-900">
                  {developer.name}
                </h3>
                <p className="text-primary-700 mt-1 font-medium">
                  {developer.role}
                </p>
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
