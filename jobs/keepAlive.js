import cron from 'node-cron';
import axios from 'axios';

/**
 * Pings the HuggingFace AI service every 4 minutes to prevent it from sleeping.
 * HuggingFace free-tier Spaces sleep after ~5 minutes of inactivity.
 * Also pings own Render backend to keep it awake (free-tier spins down after ~15 mins).
 */
const startKeepAliveJob = () => {
  const AI_SERVICE_URL = process.env.PYTHON_AI_SERVICE_URL || 'https://Sidharth772-lexai-ai-service.hf.space';
  const BACKEND_URL = process.env.BACKEND_SELF_URL || 'https://lexai-backend-sb55.onrender.com';

  // Ping every 4 minutes
  cron.schedule('*/4 * * * *', async () => {
    // Ping HuggingFace AI service
    try {
      await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 15000 });
      console.log(`[KeepAlive] HuggingFace AI service pinged successfully.`);
    } catch (err) {
      // Also try root if /health doesn't exist
      try {
        await axios.get(AI_SERVICE_URL, { timeout: 15000 });
        console.log(`[KeepAlive] HuggingFace AI service root pinged (waking up).`);
      } catch (e) {
        console.warn(`[KeepAlive] HuggingFace ping failed: ${e.message}`);
      }
    }

    // Ping own backend to keep Render from spinning down
    try {
      await axios.get(`${BACKEND_URL}/api/health`, { timeout: 15000 });
      console.log(`[KeepAlive] Backend self-ping OK.`);
    } catch (err) {
      console.warn(`[KeepAlive] Backend self-ping failed: ${err.message}`);
    }
  });

  console.log('LegalMind KeepAlive Job scheduled (every 4 minutes) for HuggingFace & Render.');
};

export default startKeepAliveJob;
