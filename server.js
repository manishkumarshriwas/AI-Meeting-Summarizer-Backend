import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// Initialize OpenAI if API key exists
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Function to generate summary
const generateSummary = async (transcript, instruction = "") => {
  if (!transcript) throw new Error("Transcript required");

  const prompt = instruction
    ? `Summarize the following transcript according to the instruction: ${instruction}\n\nTranscript:\n${transcript}`
    : `Summarize the following transcript:\n${transcript}`;

  // If OpenAI API key exists, call OpenAI
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens: 500,
      });
      return completion.choices[0].message.content.trim();
    } catch (err) {
      console.error("OpenAI Error:", err);
      // fallback to mock summary if OpenAI fails
      return "This is a mock summary because OpenAI request failed.";
    }
  }

  // If no API key, return a mock summary
  return "This is a mock summary because OpenAI API key is not provided.";
};

// Summary API
app.post("/api/generate-summary", async (req, res) => {
  try {
    const { transcript, instruction } = req.body;
    const summary = await generateSummary(transcript, instruction);
    res.json({ summary });
  } catch (err) {
    console.error("Summary Error:", err.message);
    res.status(500).json({ error: err.message || "Error generating summary" });
  }
});

// Email API
app.post("/api/send-email", async (req, res) => {
  try {
    const { recipients, subject, summary } = req.body;

    if (!recipients || !subject || !summary) {
      return res.status(400).json({
        error: "Recipients, subject, and summary are required to send email.",
      });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({
        error:
          "Email credentials not set. Add EMAIL_USER and EMAIL_PASS to environment variables.",
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // App password recommended
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: recipients.split(",").map((email) => email.trim()),
      subject,
      text: summary,
    });

    res.json({ message: "Email sent successfully!" });
  } catch (err) {
    console.error("Email Error:", err);
    res.status(500).json({ error: err.message || "Error sending email" });
  }
});

// Health check
app.get("/", (req, res) => {
  res.send(
    `Meeting Notes AI backend is running! OpenAI ${
      openai ? "enabled" : "disabled (mock summaries active)"
    }`
  );
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
