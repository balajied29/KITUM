const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 587,
  secure: process.env.MAIL_PORT === '465', // true for port 465, false for 587
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

/**
 * Send a 6-digit OTP to the given email address.
 * @param {string} to   - recipient email
 * @param {string} otp  - plaintext OTP (hashed before storage, sent plaintext here)
 */
async function sendOtpEmail(to, otp) {
  const mailOptions = {
    from: `"KIT UM" <${process.env.MAIL_FROM}>`,
    to,
    subject: 'Your login OTP',
    html: `
      <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 8px;">
        <h2 style="color: #0f172a; margin: 0 0 8px;">Your one-time password</h2>
        <p style="color: #64748b; margin: 0 0 24px;">Use the code below to log in to KIT UM. It expires in <strong>10 minutes</strong>.</p>
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; text-align: center;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1d4ed8;">${otp}</span>
        </div>
        <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendOtpEmail };
