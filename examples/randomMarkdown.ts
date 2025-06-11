import { convertMarkdownToPdf } from "@serendipityai/markdown2pdf-typescript";
import { OpenAI } from "openai"; // npm install openai

const openai = new OpenAI();

async function generateRandomMarkdown(topic?: string): Promise<string> {
  if (!topic) {
    const topics = [
      "How to Brew the Perfect Cup of Coffee",
      "Beginner's Guide to TypeScript",
      "A Travelogue on Iceland",
      "The History of the Internet",
      "Understanding Quantum Mechanics"
    ];
    topic = topics[Math.floor(Math.random() * topics.length)];
  }

  const prompt = `
You are a Markdown-savvy technical writer.
Write a simple and well-formatted markdown document on the topic: **${topic}**.
Include:
- Headings
- Bullet points
- Numbered lists
- Blockquotes
- Emphasis (bold/italic)
- Emojis
- Code blocks if appropriate
- Links and inline images (use placeholders)

Do not prefix or suffix the content with any additional text; be sure to ONLY output markdown content.
NEVER enclose the markdown content in triple backticks or any other code block format.
Start now.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a helpful Markdown generator." },
      { role: "user", content: prompt }
    ],
    temperature: 0.1,
    max_tokens: 1500
  });

  return (response.choices[0]?.message?.content || "");
}

async function pay(offer: any) {
  console.log("Paying using Alby:");
  // const payment = new Payment();
  // const payResult = await payment.bolt11_payment(offer.payment_request);
  // console.log(`Payment made: ${payResult}`);
  console.log("(Alby payment integration would go here)");
  await new Promise(resolve => { process.stdin.once("data", () => resolve(undefined)); });
}

async function main() {
 const md = await generateRandomMarkdown();
 console.log("Generated Markdown Content:", md);

 const path = await convertMarkdownToPdf(md, { downloadPath: "output.pdf", onPaymentRequest: pay });
 console.log("Saved PDF to:", path);
}

main().catch(console.error); 