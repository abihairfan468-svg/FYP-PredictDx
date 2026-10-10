import { Link, useNavigate } from 'react-router-dom';
import { useAuth, HOME } from '../lib/auth';
import { Mark, Icon } from '../lib/ui';
import './landing.css';

export default function Landing() {
  const { user } = useAuth();
  const nav = useNavigate();

  return (
    <div className="landing-page">
      {/* ═════════════════════════════════════════════════════════════
           HEADER / NAVIGATION
           ═════════════════════════════════════════════════════════════ */}
      <header className="landing-header">
        <div className="landing-header-content">
          <Link to="/" className="landing-logo">
            <span className="logo-icon"><Mark s={20} color="#fff" /></span>
            <span className="logo-text">PredictDx</span>
          </Link>
          <nav className="landing-nav-links">
            <a href="#how">How it works</a>
            <a href="#diagnosis">AI diagnosis</a>
            <a href="#doctor">Find a doctor</a>
            <a href="#about">About</a>
          </nav>
          <div className="landing-header-actions">
            <Link to={user ? HOME[user.role] : '/auth'} className="btn btn-primary sm">
              {user ? 'Open dashboard' : 'Sign in'}
            </Link>
            <Link to="/auth?signup=1" className="btn btn-secondary sm">
              Create account
            </Link>
          </div>
        </div>
      </header>

      {/* ═════════════════════════════════════════════════════════════
           HERO SECTION - Left text, Right X-ray image
           ═════════════════════════════════════════════════════════════ */}
      <section className="landing-hero">
        <div className="hero-content">
          <div className="hero-text">
            <span className="hero-badge">CHEST X-RAY SCREENING</span>
            <h1>Earlier answers for pneumonia and tuberculosis.</h1>
            <p>Upload a chest X-ray, get an AI-assisted reading with a heatmap of what it found, and have a chest specialist review it with you. Appointments, reports and prescriptions stay in one record.</p>
            <div className="hero-cta">
              <button className="btn btn-primary lg" onClick={() => nav('/auth?signup=1')}>
                Create a patient account
              </button>
            </div>
            <p className="hero-note">Every AI result is reviewed by a qualified doctor before it is shared with you.</p>
          </div>

          <div className="hero-image">
            <div className="xray-container">
              <img src="/img/xray-chest.jpg" alt="Chest X-ray scan" className="xray-image" />
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
           AI DIAGNOSIS SECTION
           ═════════════════════════════════════════════════════════════ */}
      <section className="landing-section" id="diagnosis">
        <div className="section-container">
          <h2>AI Diagnosis Technology</h2>
          <p className="section-subtitle">Our advanced machine learning models analyze chest X-rays with medical-grade accuracy.</p>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon icon-scan"><Icon n="scan" s={32} /></div>
              <h3>Detailed Analysis</h3>
              <p>AI examines every region of the chest X-ray and identifies potential abnormalities in real-time.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon icon-chart"><Icon n="chart" s={32} /></div>
              <h3>Risk Assessment</h3>
              <p>Get a comprehensive risk score for future complications based on current findings.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon icon-check"><Icon n="check" s={32} /></div>
              <h3>Doctor Verified</h3>
              <p>Every AI diagnosis is reviewed and confirmed by a qualified chest specialist before delivery.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
           FIND A DOCTOR SECTION
           ═════════════════════════════════════════════════════════════ */}
      <section className="landing-section" id="doctor">
        <div className="section-container">
          <h2>Find a Doctor</h2>
          <p className="section-subtitle">Connect with board-certified chest specialists for professional review and guidance.</p>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon icon-users"><Icon n="users" s={32} /></div>
              <h3>Qualified Specialists</h3>
              <p>Our network includes experienced pulmonologists and radiologists ready to review your results.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon icon-cal"><Icon n="cal" s={32} /></div>
              <h3>Easy Scheduling</h3>
              <p>Book appointments directly through the platform with flexible scheduling options.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon icon-chat"><Icon n="chat" s={32} /></div>
              <h3>Direct Communication</h3>
              <p>Chat with your assigned doctor, ask questions, and receive personalized medical advice.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
           ABOUT SECTION
           ═════════════════════════════════════════════════════════════ */}
      <section className="landing-section" id="about">
        <div className="section-container">
          <h2>About PredictDx</h2>
          <p className="section-subtitle">Improving respiratory health through AI-assisted diagnosis and expert medical care.</p>
          <div className="about-content">
            <div className="about-block">
              <div className="block-icon"><Icon n="lungs" s={28} /></div>
              <h3>Our Mission</h3>
              <p>To provide early, accurate detection of chest diseases like pneumonia and tuberculosis, enabling patients to receive timely treatment and improving health outcomes globally.</p>
            </div>
            <div className="about-block">
              <div className="block-icon"><Icon n="shield" s={28} /></div>
              <h3>Why PredictDx</h3>
              <p>We combine cutting-edge AI technology with expert medical professionals to deliver a comprehensive diagnostic experience that puts patients in control of their health journey.</p>
            </div>
            <div className="about-block">
              <div className="block-icon"><Icon n="users" s={28} /></div>
              <h3>Trusted by Healthcare Providers</h3>
              <p>Used by hospitals, clinics, and medical centers worldwide to enhance diagnostic accuracy and patient outcomes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
           HOW IT WORKS SECTION
           ═════════════════════════════════════════════════════════════ */}
      <section className="landing-how" id="how">
        <h2>How it works</h2>
        <p className="section-subtitle">Three steps from X-ray to treatment plan, with a doctor involved at each one.</p>

        <div className="steps-grid">
          <div className="step">
            <div className="step-number">Step 1</div>
            <div className="step-title">Upload your X-ray</div>
            <p>Add a chest X-ray and a few details about your health history.</p>
          </div>
          <div className="step">
            <div className="step-number">Step 2</div>
            <div className="step-title">Get the AI reading</div>
            <p>The model checks for pneumonia and TB, marks the areas it focused on and estimates future risk.</p>
          </div>
          <div className="step">
            <div className="step-number">Step 3</div>
            <div className="step-title">See a specialist</div>
            <p>A chest specialist reviews the result, meets with you and writes your prescription.</p>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
           FOOTER
           ═════════════════════════════════════════════════════════════ */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-links">
            <a href="#about">For patients</a>
            <a href="#doctor">For doctors</a>
            <a href="#hospital">For hospitals</a>
            <span>Questions? support@predictdx.com</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
