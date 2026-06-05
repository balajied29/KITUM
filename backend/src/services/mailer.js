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

/**
 * Send a password-reset link.
 * @param {string} to    - recipient email
 * @param {string} link  - full reset URL (token embedded)
 */
async function sendPasswordResetEmail(to, link) {
  const mailOptions = {
    from: `"Shillong Water" <${process.env.MAIL_FROM}>`,
    to,
    subject: 'Reset your password',
    html: `
      <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 8px;">
        <h2 style="color: #0f172a; margin: 0 0 8px;">Reset your password</h2>
        <p style="color: #64748b; margin: 0 0 24px;">We received a request to reset your Shillong Water password. This link expires in <strong>1 hour</strong>.</p>
        <a href="${link}" style="display:inline-block; background:#0037b0; color:#fff; text-decoration:none; padding:14px 28px; border-radius:10px; font-weight:700;">Reset password</a>
        <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendOtpEmail, sendPasswordResetEmail };
