const nodemailer = require('nodemailer');

// Transporter — configured via Railway environment variables
// Set these in Railway → Variables:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_PORT === '465',
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendEmail({ to, subject, html }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[Email] Not configured — would have sent to ${to}: ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to, subject, html,
    });
    console.log(`[Email] Sent to ${to}: ${subject}`);
  } catch(e) {
    console.error(`[Email] Failed to send to ${to}:`, e.message);
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────

function leaveRequestEmail({ managerName, employeeName, leaveType, startDate, endDate, totalDays, reason }) {
  return {
    subject: `Leave Request — ${employeeName} (${leaveType})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#1e40af;padding:20px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">🗓️ HR Leave System</h1>
          <p style="color:#bfdbfe;margin:4px 0 0">Kinetics Group</p>
        </div>
        <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
          <p style="color:#374151">Hi <strong>${managerName}</strong>,</p>
          <p style="color:#374151"><strong>${employeeName}</strong> has submitted a leave request that requires your approval:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;background:white;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
            <tr style="background:#eff6ff"><td style="padding:10px 16px;color:#6b7280;width:40%">Leave Type</td><td style="padding:10px 16px;font-weight:600;text-transform:capitalize">${leaveType}</td></tr>
            <tr><td style="padding:10px 16px;color:#6b7280;border-top:1px solid #f3f4f6">From</td><td style="padding:10px 16px;font-weight:600;border-top:1px solid #f3f4f6">${startDate}</td></tr>
            <tr style="background:#eff6ff"><td style="padding:10px 16px;color:#6b7280">To</td><td style="padding:10px 16px;font-weight:600">${endDate}</td></tr>
            <tr><td style="padding:10px 16px;color:#6b7280;border-top:1px solid #f3f4f6">Duration</td><td style="padding:10px 16px;font-weight:600;border-top:1px solid #f3f4f6">${totalDays} day(s)</td></tr>
            ${reason ? `<tr style="background:#eff6ff"><td style="padding:10px 16px;color:#6b7280">Reason</td><td style="padding:10px 16px">${reason}</td></tr>` : ''}
          </table>
          <p style="color:#374151">Please log in to approve or reject this request:</p>
          <a href="${process.env.APP_URL || 'https://hr-app-production-8b93.up.railway.app'}/leave/approvals"
             style="display:inline-block;background:#1e40af;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            Review Request →
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">Kinetics Group HR Leave System</p>
        </div>
      </div>
    `,
  };
}

function leaveApprovedEmail({ employeeName, leaveType, startDate, endDate, totalDays, approvedByName }) {
  return {
    subject: `✅ Leave Approved — ${leaveType} (${startDate} to ${endDate})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#1e40af;padding:20px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">🗓️ HR Leave System</h1>
          <p style="color:#bfdbfe;margin:4px 0 0">Kinetics Group</p>
        </div>
        <div style="background:#f0fdf4;padding:24px;border:1px solid #bbf7d0;border-top:none;border-radius:0 0 8px 8px">
          <p style="color:#374151">Hi <strong>${employeeName}</strong>,</p>
          <div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:16px;margin:16px 0">
            <p style="color:#166534;font-weight:600;margin:0">✅ Your leave request has been approved!</p>
          </div>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;background:white;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
            <tr style="background:#f0fdf4"><td style="padding:10px 16px;color:#6b7280;width:40%">Leave Type</td><td style="padding:10px 16px;font-weight:600;text-transform:capitalize">${leaveType}</td></tr>
            <tr><td style="padding:10px 16px;color:#6b7280;border-top:1px solid #f3f4f6">From</td><td style="padding:10px 16px;font-weight:600;border-top:1px solid #f3f4f6">${startDate}</td></tr>
            <tr style="background:#f0fdf4"><td style="padding:10px 16px;color:#6b7280">To</td><td style="padding:10px 16px;font-weight:600">${endDate}</td></tr>
            <tr><td style="padding:10px 16px;color:#6b7280;border-top:1px solid #f3f4f6">Duration</td><td style="padding:10px 16px;font-weight:600;border-top:1px solid #f3f4f6">${totalDays} day(s)</td></tr>
            <tr style="background:#f0fdf4"><td style="padding:10px 16px;color:#6b7280">Approved by</td><td style="padding:10px 16px;font-weight:600">${approvedByName}</td></tr>
          </table>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">Kinetics Group HR Leave System</p>
        </div>
      </div>
    `,
  };
}

function leaveRejectedEmail({ employeeName, leaveType, startDate, endDate, rejectionReason, rejectedByName }) {
  return {
    subject: `❌ Leave Rejected — ${leaveType} (${startDate} to ${endDate})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#1e40af;padding:20px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">🗓️ HR Leave System</h1>
          <p style="color:#bfdbfe;margin:4px 0 0">Kinetics Group</p>
        </div>
        <div style="background:#fff7f7;padding:24px;border:1px solid #fecaca;border-top:none;border-radius:0 0 8px 8px">
          <p style="color:#374151">Hi <strong>${employeeName}</strong>,</p>
          <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin:16px 0">
            <p style="color:#991b1b;font-weight:600;margin:0">❌ Your leave request has been rejected.</p>
          </div>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;background:white;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
            <tr style="background:#fff7f7"><td style="padding:10px 16px;color:#6b7280;width:40%">Leave Type</td><td style="padding:10px 16px;font-weight:600;text-transform:capitalize">${leaveType}</td></tr>
            <tr><td style="padding:10px 16px;color:#6b7280;border-top:1px solid #f3f4f6">Dates</td><td style="padding:10px 16px;font-weight:600;border-top:1px solid #f3f4f6">${startDate} to ${endDate}</td></tr>
            <tr style="background:#fff7f7"><td style="padding:10px 16px;color:#6b7280">Rejected by</td><td style="padding:10px 16px;font-weight:600">${rejectedByName}</td></tr>
            ${rejectionReason ? `<tr><td style="padding:10px 16px;color:#6b7280;border-top:1px solid #f3f4f6">Reason</td><td style="padding:10px 16px;border-top:1px solid #f3f4f6">${rejectionReason}</td></tr>` : ''}
          </table>
          <p style="color:#374151">Please contact your manager or HR if you have any questions.</p>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">Kinetics Group HR Leave System</p>
        </div>
      </div>
    `,
  };
}

module.exports = { sendEmail, leaveRequestEmail, leaveApprovedEmail, leaveRejectedEmail };
