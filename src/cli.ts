/* eslint-disable no-console */
import { Command } from "commander";
import { convertMarkdownToPdf } from "./convertMarkdownToPdf.js";
import chalk from "chalk";
import fs from "fs-extra";

const program = new Command();

program
  .name("md2pdf")
  .description(
    "⚡ Markdown to PDF conversion, for agents. Bridge the gap for the final stage of your agentic workflow.",
  )
  .version("0.0.1")
  .argument("<input>", "Input markdown file or markdown string")
  .option("-o, --output <output>", "Output PDF file path")
  .option("-t, --title <title>", "Document title", "Markdown2PDF.ai converted document")
  .option("-d, --date <date>", "Document date (defaults to current date)")
  .action(async (input: string, options: { output?: string; title?: string; date?: string }) => {
    try {
      // Handle payment requests
      const handlePayment = async (offer: any) => {
        console.log(chalk.yellow("\n⚡ Lightning payment required"));
        console.log(chalk.white(`Amount: ${offer.amount} ${offer.currency}`));
        console.log(chalk.white(`Description: ${offer.description}`));
        console.log(chalk.white(`Invoice: ${offer.payment_request}`));

        // Wait for user to press Enter
        await new Promise<void>((resolve) => {
          console.log(chalk.yellow("\nPress Enter once paid..."));
          process.stdin.once("data", () => resolve());
        });
      };

      // Read markdown from file or use as string
      let markdown: string;
      try {
        markdown = await fs.readFile(input, "utf-8");
      } catch {
        // If file doesn't exist, use input as markdown string
        markdown = input;
      }

      const result = await convertMarkdownToPdf(markdown, {
        onPaymentRequest: handlePayment,
        title: options.title,
        date: options.date,
        downloadPath: options.output,
        returnBytes: false,
      });

      if (typeof result === "string" && !options.output) {
        console.log(chalk.green("\nPDF URL:"), result);
      } else {
        console.log(chalk.green("\nSaved PDF to:"), result);
      }
    } catch (error) {
      console.error(chalk.red("\nError:"), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();
