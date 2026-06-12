import nodemailer from 'nodemailer';

// Create transporter using environment variables
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports (587 uses STARTTLS)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify SMTP connection configuration on startup
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn('⚠️  Warning: EMAIL_USER or EMAIL_PASS not set in environment. Email alert system will fail to send emails.');
} else {
  transporter.verify((error) => {
    if (error) {
      console.error('❌ Email SMTP Transporter configuration error:', error.message);
    } else {
      console.log('✅ Email SMTP Transporter is ready to send alerts');
    }
  });
}


// Helper to get frontend url
const getFrontendUrl = () => {
  return process.env.FRONTEND_URL || 'http://localhost:3000';
};

// Helper: Format Document Type
const formatDocType = (type) => {
  if (!type) return 'Document';
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

/**
 * Sends a notification email when document analysis is complete
 */
export const sendAnalysisCompleteEmail = async (userEmail, userName, document) => {
  const docName = document.name;
  const docId = document._id;
  const riskLevel = document.riskLevel || 'safe';
  const summary = document.summary || 'No summary generated.';
  const frontendUrl = getFrontendUrl();

  // Map risk level to colors
  let riskColor = '#10b981'; // green
  let riskBg = '#d1fae5';
  if (riskLevel === 'caution') {
    riskColor = '#d97706'; // dark amber
    riskBg = '#fef3c7';
  } else if (riskLevel === 'risky') {
    riskColor = '#dc2626'; // dark red
    riskBg = '#fee2e2';
  }

  // Filter top 3 risky/caution clauses
  const flaggedClauses = (document.clauses || [])
    .filter(c => c.riskLevel === 'risky' || c.riskLevel === 'caution')
    .slice(0, 3);

  // Build key findings HTML
  let keyFindingsHtml = '';
  if (flaggedClauses.length > 0) {
    keyFindingsHtml = `
      <h3 style="color: #1f2937; margin-top: 25px; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px;">Key Findings</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
    `;
    flaggedClauses.forEach(clause => {
      let badgeColor = '#d97706';
      let badgeBg = '#fef3c7';
      if (clause.riskLevel === 'risky') {
        badgeColor = '#dc2626';
        badgeBg = '#fee2e2';
      }

      keyFindingsHtml += `
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 12px 0; vertical-align: top;">
            <div style="font-weight: bold; color: #111827; font-size: 14px;">${clause.title}</div>
            <div style="color: #4b5563; font-size: 13px; margin-top: 4px; line-height: 1.4;">${clause.explanation}</div>
          </td>
          <td style="padding: 12px 0; text-align: right; vertical-align: top; width: 80px;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; background-color: ${badgeBg}; color: ${badgeColor};">
              ${clause.riskLevel}
            </span>
          </td>
        </tr>
      `;
    });
    keyFindingsHtml += `</table>`;
  } else {
    keyFindingsHtml = `
      <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; border-radius: 6px; margin: 25px 0; text-align: left;">
        <p style="color: #065f46; font-weight: bold; margin: 0; font-size: 14px;">Good news!</p>
        <p style="color: #047857; margin: 5px 0 0 0; font-size: 13px;">No major issues found in your document.</p>
      </div>
    `;
  }

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>LexAI Document Analysis Complete</title>
    </head>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 20px; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e6ebf1;">
        <!-- Header -->
        <tr>
          <td style="background-color: #0f3460; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 1px;">LexAI</h1>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding: 40px 30px;">
            <p style="font-size: 16px; color: #4b5563; margin-top: 0;">Hello ${userName},</p>
            <p style="font-size: 16px; color: #1f2937; font-weight: 500;">Your document analysis for <strong>"${docName}"</strong> is complete.</p>
            
            <!-- Overall Risk Badge -->
            <div style="text-align: center; margin: 25px 0;">
              <div style="display: inline-block; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 18px; background-color: ${riskBg}; color: ${riskColor}; text-transform: uppercase; letter-spacing: 1px; border: 1px solid ${riskColor}30;">
                Risk Rating: ${riskLevel}
              </div>
            </div>

            <!-- Summary Section -->
            <h3 style="color: #1f2937; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px;">Executive Summary</h3>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
              ${summary}
            </p>

            <!-- Key Findings -->
            ${keyFindingsHtml}

            <!-- CTA Button -->
            <div style="text-align: center; margin: 35px 0 20px 0;">
              <a href="${frontendUrl}/document/${docId}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 30px; font-size: 15px; font-weight: bold; border-radius: 8px; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.15); transition: background-color 0.2s;">
                View Full Analysis
              </a>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color: #fafbfc; border-top: 1px solid #f1f3f7; padding: 25px 30px; text-align: center;">
            <p style="font-size: 11px; color: #9ca3af; line-height: 1.5; margin: 0 0 15px 0;">
              This analysis is for informational purposes only. Consult a qualified lawyer for legal advice.
            </p>
            <p style="font-size: 13px; color: #4b5563; font-weight: bold; margin: 0;">
              — The LexAI Team
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"LexAI" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `LexAI Analysis Complete — ${docName}`,
    html: emailHtml,
  };

  return transporter.sendMail(mailOptions);
};

/**
 * Sends a reminder email when a document is close to its expiration date
 */
export const sendExpiryReminderEmail = async (userEmail, userName, document, daysLeft) => {
  const docName = document.name;
  const docId = document._id;
  const docType = formatDocType(document.type);
  const expiryDate = document.expiryDate;
  const frontendUrl = getFrontendUrl();

  const formattedDate = new Date(expiryDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Get top 3 clauses
  const topClauses = (document.clauses || []).slice(0, 3);
  let clausesListHtml = '';
  if (topClauses.length > 0) {
    clausesListHtml = `
      <h3 style="color: #1f2937; margin-top: 25px; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px;">Key terms to review before renewal</h3>
      <ul style="padding-left: 20px; color: #4b5563; font-size: 14px; line-height: 1.6;">
    `;
    topClauses.forEach(clause => {
      clausesListHtml += `
        <li style="margin-bottom: 10px;">
          <strong style="color: #111827;">${clause.title}</strong>: ${clause.explanation}
        </li>
      `;
    });
    clausesListHtml += `</ul>`;
  }

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Document Expiration Alert</title>
    </head>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 20px; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e6ebf1;">
        <!-- Header -->
        <tr>
          <td style="background-color: #0f3460; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 1px;">LexAI</h1>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding: 40px 30px;">
            <p style="font-size: 16px; color: #4b5563; margin-top: 0;">Hello ${userName},</p>
            <p style="font-size: 16px; color: #1f2937; line-height: 1.5;">
              This is a reminder that your ${docType} <strong>"${docName}"</strong> expires in <span style="color: #dc2626; font-weight: bold;">${daysLeft} days</span>.
            </p>
            
            <!-- Expiry Box -->
            <div style="background-color: #fff5f5; border: 1px dashed #f87171; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
              <p style="color: #7f1d1d; font-size: 13px; font-weight: bold; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">Expiration Date</p>
              <h2 style="color: #dc2626; margin: 5px 0 0 0; font-size: 20px; font-weight: bold;">${formattedDate}</h2>
            </div>

            <!-- Review Items -->
            ${clausesListHtml}

            <!-- CTA Button -->
            <div style="text-align: center; margin: 35px 0 20px 0;">
              <a href="${frontendUrl}/document/${docId}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 30px; font-size: 15px; font-weight: bold; border-radius: 8px; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.15); transition: background-color 0.2s;">
                Review Document
              </a>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color: #fafbfc; border-top: 1px solid #f1f3f7; padding: 25px 30px; text-align: center;">
            <p style="font-size: 11px; color: #9ca3af; line-height: 1.5; margin: 0 0 15px 0;">
              This analysis is for informational purposes only. Consult a qualified lawyer for legal advice.
            </p>
            <p style="font-size: 13px; color: #4b5563; font-weight: bold; margin: 0;">
              — The LexAI Team
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"LexAI" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `Reminder: Your ${docType} expires in ${daysLeft} days`,
    html: emailHtml,
  };

  return transporter.sendMail(mailOptions);
};

/**
 * Sends a registration or password reset OTP verification code
 */
export const sendOtpEmail = async (userEmail, otp, type) => {
  const isRegister = type === 'register';
  const subject = isRegister ? 'LexAI — Verify Your Account' : 'LexAI — Reset Your Password';
  const titleText = isRegister ? 'Verify Your Account' : 'Reset Your Password';
  const bodyText = isRegister 
    ? 'Thank you for signing up for LexAI. Use the verification code below to complete your registration:' 
    : 'We received a request to reset your password. Use the verification code below to set a new password:';
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 20px; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e6ebf1;">
        <!-- Header -->
        <tr>
          <td style="background-color: #0f3460; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 1px;">LexAI</h1>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding: 40px 30px;">
            <h2 style="color: #1f2937; margin-top: 0; font-size: 20px; font-weight: bold;">${titleText}</h2>
            <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
              ${bodyText}
            </p>
            
            <!-- OTP Display Box -->
            <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #4f46e5;">
                ${otp}
              </span>
            </div>

            <p style="font-size: 12px; color: #9ca3af; line-height: 1.5; margin-top: 25px;">
              This verification code is valid for 10 minutes. If you did not make this request, please ignore this email.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color: #fafbfc; border-top: 1px solid #f1f3f7; padding: 25px 30px; text-align: center;">
            <p style="font-size: 13px; color: #4b5563; font-weight: bold; margin: 0;">
              — The LexAI Team
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"LexAI" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: subject,
    html: emailHtml,
  };

  return transporter.sendMail(mailOptions);
};

