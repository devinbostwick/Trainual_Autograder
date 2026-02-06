<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Trainual Autograder

An AI-powered exam grading application built with React, TypeScript, and Google's Gemini API. This app allows you to automatically grade exams and provide detailed feedback to students.

🔗 **[Live Demo](https://devinbostwick.github.io/Trainual_Autograder/)**

## Features

- 📝 Automatic exam grading using AI
- 💡 Detailed feedback and explanations
- 🎯 Support for multiple exam types
- 🚀 Fast and accurate results
- 🎨 Clean, modern UI

## Quick Start

### Option 1: Use the Live App

Simply visit the [live app](https://devinbostwick.github.io/Trainual_Autograder/) and enter your Gemini API key to get started.

### Option 2: Run Locally

**Prerequisites:** Node.js (v16 or higher)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/devinbostwick/Trainual_Autograder.git
   cd Trainual_Autograder
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up your API key:**
   - Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey)
   - Create a `.env.local` file in the root directory
   - Add your API key:
     ```
     GEMINI_API_KEY=your_api_key_here
     ```

4. **Run the app:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to `http://localhost:3000`

## How to Get a Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key and use it in the app

**Note:** The API key is stored locally in your browser and is never sent to any server except Google's Gemini API.

## Deployment

This app is automatically deployed to GitHub Pages. To deploy your own version:

1. **Update the repository URL** in `package.json` and `vite.config.ts`
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Deploy:**
   ```bash
   npm run deploy
   ```

## Tech Stack

- **Frontend:** React 19, TypeScript
- **Build Tool:** Vite
- **AI:** Google Gemini API
- **Styling:** Modern CSS
- **Icons:** Lucide React
- **Hosting:** GitHub Pages

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for your own purposes.

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/devinbostwick/Trainual_Autograder/issues).

---

Made with ❤️ by [Devin Bostwick](https://github.com/devinbostwick)

