import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Bot,
  Check,
  CircleDollarSign,
  GitBranch,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import './Landing.css'

const workflow = [
  {
    number: '01',
    title: 'Detect',
    description: 'Identify payment failures and open a recovery case.',
    icon: CircleDollarSign,
  },
  {
    number: '02',
    title: 'Assess',
    description: 'Estimate recovery probability and revenue exposure.',
    icon: GitBranch,
  },
  {
    number: '03',
    title: 'Decide',
    description: 'Select the safest recovery intervention for the case.',
    icon: Bot,
  },
  {
    number: '04',
    title: 'Protect',
    description: 'Evaluate the action against merchant recovery policies.',
    icon: ShieldCheck,
  },
  {
    number: '05',
    title: 'Recover',
    description: 'Execute, observe the outcome, or escalate to humans.',
    icon: Zap,
  },
]

const capabilities = [
  {
    icon: Bot,
    title: 'Agentic decisions',
    description:
      'Vidur evaluates recovery context and selects an intervention instead of relying on a fixed retry script.',
  },
  {
    icon: ShieldCheck,
    title: 'Policy controlled',
    description:
      'Recovery actions are checked against merchant-defined limits before execution.',
  },
  {
    icon: GitBranch,
    title: 'Observable recovery',
    description:
      'Every action, decision, policy result, and outcome becomes part of the recovery timeline.',
  },
]

export function Landing() {
  const navigate = useNavigate()

  return (
    <div className="landing-page">
      <div className="landing-grid" />

      {/* Navigation */}

      <nav className="landing-nav">
        <a
          className="landing-brand"
          href="/"
          aria-label="Vidur AI home"
        >
          <div className="landing-brand-mark">
            <span>V</span>
          </div>

          <div>
            <div className="landing-brand-name">
              Vidur AI
            </div>

            <div className="landing-brand-caption">
              Agentic Revenue Recovery
            </div>
          </div>
        </a>

        <div className="landing-nav-links">
          <a href="#platform">Platform</a>
          <a href="#workflow">How it works</a>
          <a href="#intelligence">Intelligence</a>
        </div>

        <Button
          className="landing-nav-button"
          onClick={() => navigate('/dashboard')}
        >
          Open Dashboard
          <ArrowRight size={15} />
        </Button>
      </nav>

      {/* Hero */}

      <main className="landing-hero">
        <div className="landing-hero-copy">
          <motion.div
            className="landing-eyebrow"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Sparkles size={14} />
            Agentic revenue recovery
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
          >
            Every failed payment
            <span> deserves a decision.</span>
          </motion.h1>

          <motion.p
            className="landing-hero-description"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
          >
            Vidur AI turns payment failures into intelligent
            recovery workflows — assessing risk, selecting
            interventions, enforcing policies, and observing
            the outcome.
          </motion.p>

          <motion.div
            className="landing-hero-actions"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28 }}
          >
            <Button
              size="lg"
              onClick={() => navigate('/dashboard')}
            >
              Explore Vidur AI
              <ArrowRight size={17} />
            </Button>

            <a
              className="landing-text-action"
              href="#workflow"
            >
              See how it works
            </a>
          </motion.div>

          <motion.div
            className="landing-hero-meta"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.45 }}
          >
            <span>
              <Check size={13} />
              Risk aware
            </span>

            <span>
              <Check size={13} />
              Policy controlled
            </span>

            <span>
              <Check size={13} />
              Fully observable
            </span>
          </motion.div>
        </div>

        {/* Hero intelligence visual */}

        <motion.div
          className="landing-hero-visual"
          initial={{ opacity: 0, x: 45 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.85, delay: 0.2 }}
        >
          <div className="hero-glow" />

          <div className="intelligence-card">
            <div className="intelligence-top">
              <div>
                <span className="card-overline">
                  Recovery intelligence
                </span>

                <h2>Agent decision</h2>
              </div>

              <span className="live-status">
                <span />
                Operational
              </span>
            </div>

            <div className="intelligence-main-metric">
              <span>Revenue at risk</span>

              <strong>₹5,388.92</strong>

              <div className="metric-trend">
                <span>Recovery case</span>
                <span>MEDIUM RISK</span>
              </div>
            </div>

            <div className="intelligence-stats">
              <div>
                <span>Recovery probability</span>
                <strong>40%</strong>
              </div>

              <div>
                <span>Failure reason</span>
                <strong>Insufficient funds</strong>
              </div>
            </div>

            <div className="agent-decision-card">
              <div className="decision-icon">
                <Bot size={18} />
              </div>

              <div className="decision-copy">
                <span>Recommended intervention</span>
                <strong>Retry payment</strong>
              </div>

              <span className="decision-allow">
                ALLOW
              </span>
            </div>

            <div className="decision-flow">
              <div className="flow-line">
                <span className="flow-node active">
                  <Bot size={13} />
                </span>

                <span />

                <span className="flow-node">
                  <ShieldCheck size={13} />
                </span>

                <span />

                <span className="flow-node">
                  <Check size={13} />
                </span>
              </div>

              <div className="flow-labels">
                <span>Agent</span>
                <span>Policy</span>
                <span>Outcome</span>
              </div>
            </div>

            <div className="intelligence-footer">
              <span>Policy check</span>
              <strong>Passed</strong>
            </div>
          </div>

          <motion.div
            className="floating-signal signal-one"
            animate={{ y: [0, -7, 0] }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Bot size={14} />
            Agent active
          </motion.div>

          <motion.div
            className="floating-signal signal-two"
            animate={{ y: [0, 7, 0] }}
            transition={{
              duration: 4.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <ShieldCheck size={14} />
            Policy verified
          </motion.div>
        </motion.div>
      </main>

      {/* Product value strip */}

      <section className="landing-value-strip" id="platform">
        <div className="value-strip-heading">
          <span>VIDUR AI</span>
          <strong>
            A recovery system that thinks beyond retries.
          </strong>
        </div>

        <div className="value-strip-items">
          <div>
            <strong>Risk</strong>
            <span>Understand the case</span>
          </div>

          <div>
            <strong>Strategy</strong>
            <span>Choose the intervention</span>
          </div>

          <div>
            <strong>Policy</strong>
            <span>Stay within boundaries</span>
          </div>

          <div>
            <strong>Outcome</strong>
            <span>Learn from execution</span>
          </div>
        </div>
      </section>

      {/* Workflow */}

      <section
        className="landing-section workflow-section"
        id="workflow"
      >
        <div className="section-heading">
          <span className="section-kicker">
            THE RECOVERY LOOP
          </span>

          <h2>
            From payment failure
            <br />
            to recovery outcome.
          </h2>

          <p>
            Vidur connects detection, risk assessment, strategy,
            policy enforcement, execution, and observation into
            one recovery loop.
          </p>
        </div>

        <div className="workflow-grid">
          {workflow.map((item, index) => {
            const Icon = item.icon

            return (
              <motion.article
                className="workflow-card"
                key={item.number}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.06,
                }}
              >
                <div className="workflow-card-top">
                  <span>{item.number}</span>

                  <Icon size={19} />
                </div>

                <h3>{item.title}</h3>

                <p>{item.description}</p>

                {index < workflow.length - 1 && (
                  <ArrowRight
                    className="workflow-arrow"
                    size={17}
                  />
                )}
              </motion.article>
            )
          })}
        </div>
      </section>

      {/* Intelligence */}

      <section
        className="landing-section intelligence-section"
        id="intelligence"
      >
        <div className="intelligence-showcase">
          <div className="showcase-copy">
            <span className="section-kicker">
              RECOVERY INTELLIGENCE
            </span>

            <h2>
              Decisions backed by
              <span> context, not guesswork.</span>
            </h2>

            <p>
              A recovery case is more than a failed transaction.
              Vidur evaluates payment context, customer history,
              failure signals, recovery probability, and policy
              boundaries before an action is executed.
            </p>

            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
            >
              View live dashboard
              <ArrowRight size={15} />
            </Button>
          </div>

          <div className="showcase-panel">
            <div className="showcase-panel-header">
              <div>
                <span>CASE ANALYSIS</span>
                <strong>Recovery signal</strong>
              </div>

              <span className="analysis-dot">
                ● Analyzing
              </span>
            </div>

            <div className="analysis-row">
              <span>Payment method</span>
              <strong>UPI</strong>
            </div>

            <div className="analysis-row">
              <span>Failure reason</span>
              <strong>Insufficient funds</strong>
            </div>

            <div className="analysis-row">
              <span>Previous payment history</span>
              <strong>Available</strong>
            </div>

            <div className="analysis-probability">
              <div>
                <span>Recovery probability</span>
                <strong>40%</strong>
              </div>

              <div className="probability-bar">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: '40%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 1 }}
                />
              </div>
            </div>

            <div className="analysis-result">
              <div className="result-icon">
                <Bot size={16} />
              </div>

              <div>
                <span>Agent recommendation</span>
                <strong>Retry payment later</strong>
              </div>

              <Check size={17} />
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}

      <section className="landing-section capability-section">
        <div className="section-heading centered">
          <span className="section-kicker">
            BUILT FOR CONTROL
          </span>

          <h2>
            Autonomous where it should be.
            <br />
            Controlled where it matters.
          </h2>
        </div>

        <div className="capability-grid">
          {capabilities.map((item, index) => {
            const Icon = item.icon

            return (
              <motion.article
                className="capability-card"
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.08,
                }}
              >
                <div className="capability-icon">
                  <Icon size={19} />
                </div>

                <h3>{item.title}</h3>

                <p>{item.description}</p>
              </motion.article>
            )
          })}
        </div>
      </section>

      {/* CTA */}

      <section className="landing-cta">
        <div className="cta-glow" />

        <span className="section-kicker">
          VIDUR AI
        </span>

        <h2>
          Turn failed payments
          <br />
          into recoverable revenue.
        </h2>

        <p>
          See the recovery system behind the interface.
        </p>

        <Button
          size="lg"
          onClick={() => navigate('/dashboard')}
        >
          Open Vidur AI Dashboard
          <ArrowRight size={17} />
        </Button>
      </section>

      {/* Footer */}

      <footer className="landing-footer">
        <div className="footer-brand">
          <div className="footer-mark">V</div>

          <div>
            <strong>Vidur AI</strong>
            <span>Agentic Revenue Recovery</span>
          </div>
        </div>

        <span>
          Revenue recovery infrastructure for modern
          payment systems.
        </span>

        <span>© 2026 Vidur AI</span>
      </footer>
    </div>
  )
}