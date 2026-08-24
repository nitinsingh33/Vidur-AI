import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";
import "./Landing.css";

export function Landing() {
  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-brand">
          <div className="landing-brand-mark">V</div>

          <div>
            <div className="landing-brand-name">Vidur AI</div>
            <div className="landing-brand-caption">Revenue Recovery</div>
          </div>
        </div>

        <div className="landing-nav-links">
          <a href="#product">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#intelligence">Intelligence</a>
        </div>

        <Button
          onClick={() => {
            window.location.href = "/dashboard";
          }}>
          Open Dashboard
          <ArrowRight size={16} />
        </Button>
      </nav>

      <main className="landing-hero">
        <div className="landing-hero-copy">
          <motion.div
            className="landing-eyebrow"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}>
            <Sparkles size={15} />
            Agentic revenue recovery
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: 0.1,
            }}>
            Recover revenue
            <br />
            <span>before it is lost.</span>
          </motion.h1>

          <motion.p
            className="landing-hero-description"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: 0.2,
            }}>
            Vidur AI identifies failed payments, predicts recovery probability,
            selects the safest recovery strategy, and acts within your business
            policies.
          </motion.p>

          <motion.div
            className="landing-hero-actions"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: 0.3,
            }}>
            <Button
              size="lg"
              onClick={() => {
                window.location.href = "/dashboard";
              }}>
              Explore Vidur AI
              <ArrowRight size={17} />
            </Button>

            <a className="landing-secondary-action" href="#how-it-works">
              See how it works
            </a>
          </motion.div>
        </div>

        <motion.div
          className="landing-hero-visual"
          initial={{
            opacity: 0,
            x: 40,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          transition={{
            duration: 0.8,
            delay: 0.25,
          }}>
          <div className="intelligence-card">
            <div className="intelligence-header">
              <div>
                <span className="card-eyebrow">Recovery intelligence</span>
                <strong>Agent decision</strong>
              </div>

              <span className="live-indicator">
                <span />
                Live
              </span>
            </div>

            <div className="risk-metric">
              <span>Revenue at risk</span>
              <strong>₹5,388.92</strong>
            </div>

            <div className="intelligence-grid">
              <div>
                <span>Recovery probability</span>
                <strong>40%</strong>
              </div>

              <div>
                <span>Risk level</span>
                <strong>Medium</strong>
              </div>
            </div>

            <div className="agent-decision">
              <div className="decision-icon">AI</div>

              <div>
                <span>Recommended action</span>
                <strong>Retry payment</strong>
              </div>

              <span className="decision-status">ALLOW</span>
            </div>

            <div className="policy-row">
              <span>Policy check</span>
              <span>Passed</span>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
