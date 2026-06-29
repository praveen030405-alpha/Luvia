const express = require('express');
const router = express.Router();

// Scaffold for Google Workspace Integrations
// In production, this requires the Google Drive and Gmail APIs and specific OAuth scopes.

router.get('/drive/recent', (req, res) => {
  // Mock data for Phase 4 scaffold
  res.json({
    status: "success",
    message: "Google Drive API scaffold.",
    files: [
      { id: "doc1", name: "Q3 Economy Report.pdf", type: "application/pdf" },
      { id: "doc2", name: "CA Audit Notes.docx", type: "application/vnd.google-apps.document" }
    ]
  });
});

router.get('/gmail/unread', (req, res) => {
  // Mock data for Phase 4 scaffold
  res.json({
    status: "success",
    message: "Gmail API scaffold.",
    emails: [
      { id: "msg1", from: "boss@company.com", subject: "Urgent: Tax Review", snippet: "Please review the attached..." }
    ]
  });
});

module.exports = router;
