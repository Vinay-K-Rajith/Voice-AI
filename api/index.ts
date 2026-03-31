import type { NextApiRequest, NextApiResponse } from 'next';

// For Vercel deployment: This is a placeholder
// Real backend must run separately due to WebSocket requirements

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ 
    message: 'Backend should run separately - see DEPLOYMENT.md'
  });
}
