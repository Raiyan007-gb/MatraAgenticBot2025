"use client";

import { useState, useEffect, useRef } from "react";
import { ChatInput } from "@/components/ui/ChatInput";
import { ChatMessages } from "@/components/ChatMessages";
import { Message } from "@/types";
import { cn } from "@/lib/utils";
import mammoth from "mammoth";

// Generate a unique user ID
const userId = `user_${Date.now()}`; // Replace with proper user management

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolicyMode, setIsPolicyMode] = useState(false);
  const [canGeneratePDF, setCanGeneratePDF] = useState(false);
  const [awaitingLogoDecision, setAwaitingLogoDecision] = useState(false);
  const [awaitingLogoUpload, setAwaitingLogoUpload] = useState(false);
  const [policyContent, setPolicyContent] = useState<string | null>(null); // Store the generated policy content
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scrolling Effect
  useEffect(() => {
    if (hasStartedChat && scrollAreaRef.current) {
      const element = scrollAreaRef.current;
      const timeoutId = setTimeout(() => {
        element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, hasStartedChat]);

  // Check if policy has been generated and store the policy content
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage?.sender === "bot" &&
      lastMessage.text.includes("**Here is your generated policy**")
    ) {
      const content = lastMessage.text.split("**Here is your generated policy**:\n\n")[1];
      setPolicyContent(content);
      setCanGeneratePDF(true);
    }
  }, [messages]);

  // Fetch Bot Response
  const fetchBotResponse = async (prompt: string) => {
    const botMessageId = `bot-${Date.now()}`;
    const placeholderMessage: Message = { id: botMessageId, sender: "bot", text: "" };
    setMessages((prevMessages) => [...prevMessages, placeholderMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `API request failed with status ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Response body is null.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let validAnswer = "";
      let buffer = "";
      let isProcessingValidAnswer = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const textChunk = decoder.decode(value, { stream: true });
        buffer += textChunk;

        if (isProcessingValidAnswer) {
          const validAnswerEnd = buffer.indexOf("[/VALID_ANSWER]");
          if (validAnswerEnd !== -1) {
            validAnswer = buffer.substring(0, validAnswerEnd).trim();
            validAnswer = validAnswer.replace(/\[VALID_ANSWER\]|\[\/VALID_ANSWER\]/g, '').replace(/^\]+|\]+$/g, '');
            buffer = buffer.substring(validAnswerEnd + 14);
            isProcessingValidAnswer = false;
            console.log("Parsed validAnswer:", validAnswer);
          } else {
            validAnswer += buffer;
            buffer = "";
            continue;
          }
        } else {
          const validAnswerStart = buffer.indexOf("[VALID_ANSWER]");
          if (validAnswerStart !== -1) {
            accumulatedText += buffer.substring(0, validAnswerStart);
            validAnswer = "";
            buffer = buffer.substring(validAnswerStart + 13);
            isProcessingValidAnswer = true;
            continue;
          }
        }

        accumulatedText += buffer;
        buffer = "";

        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === botMessageId
              ? { ...msg, text: accumulatedText, validAnswers: validAnswer || undefined }
              : msg
          )
        );
      }

      if (isProcessingValidAnswer) {
        validAnswer += buffer;
        validAnswer = validAnswer.trim().replace(/\[VALID_ANSWER\]|\[\/VALID_ANSWER\]/g, '').replace(/^\]+|\]+$/g, '');
        console.log("Parsed validAnswer (remaining buffer):", validAnswer);
      } else {
        accumulatedText += buffer;
      }

      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === botMessageId
            ? { ...msg, text: accumulatedText, validAnswers: validAnswer || undefined }
            : msg
        )
      );
      reader.releaseLock();
      console.log("Final message:", { text: accumulatedText, validAnswers: validAnswer });
    } catch (error) {
      console.error("Error fetching or processing stream:", error);
      setMessages((prevMessages) => {
        const placeholderIndex = prevMessages.findIndex((msg) => msg.id === botMessageId);
        const errorContent = `Sorry, an error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        if (placeholderIndex !== -1) {
          const updatedMessages = [...prevMessages];
          updatedMessages[placeholderIndex] = {
            ...updatedMessages[placeholderIndex],
            text: errorContent,
          };
          return updatedMessages;
        }
        return [...prevMessages, { id: `error-${Date.now()}`, sender: "bot", text: errorContent }];
      });
    } finally {
      console.log(">>> fetchBotResponse FINALLY: Setting isLoading = false");
      setIsLoading(false);
    }
  };

  // Handle PDF Generation
  const handleGeneratePDF = async () => {
    if (!canGeneratePDF || isLoading) return;
    setIsLoading(true);

    if (!awaitingLogoDecision && !awaitingLogoUpload) {
      // Ask if user wants to include a logo
      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: "Would you like to include a company logo in the PDF? (Yes/No)",
      };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
      setAwaitingLogoDecision(true);
      setIsLoading(false);
      return;
    }
  };

  // Handle Sending Message
  const handleSendMessage = async (attachedFile?: File | null, simulatedMessage?: string) => {
    if (isLoading) return;

    setIsLoading(true);
    if (!hasStartedChat) {
      setHasStartedChat(true);
    }

    const typedText = inputValue.trim();
    const promptToSend = simulatedMessage || typedText;
    if (!promptToSend && !attachedFile) {
      setIsLoading(false);
      return;
    }

    // Handle logo decision responses
    if (awaitingLogoDecision) {
      const response = promptToSend.toLowerCase();
      if (response === "yes") {
        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: "Please upload your company logo (.png file).",
        };
        setMessages((prevMessages) => [...prevMessages, { id: `user-${Date.now()}`, sender: "user", text: promptToSend }, botMessage]);
        setAwaitingLogoDecision(false);
        setAwaitingLogoUpload(true);
        setInputValue("");
        setIsLoading(false);
        return;
      } else if (response === "no") {
        // Generate PDF without logo
        await generatePDF(null);
        setAwaitingLogoDecision(false);
        setInputValue("");
        setIsLoading(false);
        return;
      } else {
        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: "Please respond with 'Yes' or 'No'.",
        };
        setMessages((prevMessages) => [...prevMessages, { id: `user-${Date.now()}`, sender: "user", text: promptToSend }, botMessage]);
        setInputValue("");
        setIsLoading(false);
        return;
      }
    }

    // Handle logo upload
    if (awaitingLogoUpload && attachedFile) {
      if (!attachedFile.type.startsWith("image/png") && !attachedFile.name.toLowerCase().endsWith(".png")) {
        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: "Please upload a .png file for the logo.",
        };
        setMessages((prevMessages) => [
          ...prevMessages,
          { id: `user-${Date.now()}`, sender: "user", text: `Attached file: ${attachedFile.name}`, attachment: { name: attachedFile.name, type: attachedFile.type } },
          botMessage,
        ]);
        setIsLoading(false);
        return;
      }

      await generatePDF(attachedFile);
      setAwaitingLogoUpload(false);
      setInputValue("");
      setIsLoading(false);
      return;
    }

    // Update policy mode based on the message being sent
    if (promptToSend.toLowerCase() === "build policy") {
      setIsPolicyMode(true);
    } else if (promptToSend.toLowerCase() === "exit") {
      setIsPolicyMode(false);
      setAwaitingLogoDecision(false);
      setAwaitingLogoUpload(false);
      setCanGeneratePDF(false); // Reset PDF generation state on exit
      setPolicyContent(null); // Clear policy content
    }

    let fileContent = "";
    let attachmentData: Message["attachment"] | undefined = undefined;
    let readErrorOccurred = false;

    // Read File
    if (attachedFile) {
      attachmentData = { name: attachedFile.name, type: attachedFile.type || "unknown" };
      try {
        console.log(`Reading file: ${attachedFile.name}, type: ${attachedFile.type}`);
        const fileType = attachedFile.type;
        const fileNameLower = attachedFile.name.toLowerCase();

        if (fileType === "text/plain" || fileNameLower.endsWith(".txt")) {
          fileContent = await attachedFile.text();
        } else if (
          fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          fileNameLower.endsWith(".docx")
        ) {
          const arrayBuffer = await attachedFile.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          fileContent = result.value;
        } else if (fileType === "application/pdf" || fileNameLower.endsWith(".pdf")) {
          const pdfjsLib = await import("pdfjs-dist");
          pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
          const arrayBuffer = await attachedFile.arrayBuffer();
          const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let fullText = "";
          for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" ");
            fullText += pageText + "\n\n";
          }
          fileContent = fullText.trim();
        } else {
          fileContent = "[Unsupported file type - content not included]";
        }
      } catch (readError) {
        console.error(`Error reading file ${attachmentData?.name}:`, readError);
        fileContent = "[Error reading file content]";
        readErrorOccurred = true;
        alert(
          `Error reading file ${attachmentData?.name}: ${
            readError instanceof Error ? readError.message : "Unknown error"
          }`
        );
      }
    }

    // Handle errors from file reading
    if (readErrorOccurred) {
      setIsLoading(false);
      const errorUserMessage: Message = {
        id: `user-${Date.now()}`,
        sender: "user",
        text: typedText || `Failed to read file: ${attachmentData?.name || "unknown"}`,
        attachment: attachmentData,
      };
      setMessages((prevMessages) => [...prevMessages, errorUserMessage]);
      setInputValue("");
      return;
    }

    // Add user message to the chat UI only if it's not a simulated message
    if (!simulatedMessage) {
      const newMessage: Message = {
        id: `user-${Date.now()}`,
        sender: "user",
        text: typedText || `Attached file: ${attachmentData?.name || "unknown"}`,
        attachment: attachmentData,
      };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    }

    // Combine prompt with file content if applicable
    let finalPrompt = promptToSend;
    if (
      fileContent &&
      fileContent !== "[Unsupported file type - content not included]" &&
      fileContent !== "[Error reading file content]"
    ) {
      finalPrompt += `\n\n--- Content from attached file: ${attachmentData?.name} ---\n${fileContent}`;
    }

    setInputValue("");
    fetchBotResponse(finalPrompt);
  };

  // Generate PDF by calling the backend
  const generatePDF = async (logoFile: File | null) => {
    if (!policyContent) {
      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: "Error: No policy found to generate PDF. Please generate a policy first.",
      };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
      return;
    }

    const formData = new FormData();
    formData.append("policy_md", policyContent);
    if (logoFile) {
      formData.append("logo", logoFile);
    }

    try {
      const response = await fetch("/api/generate_pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `PDF generation failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "policy.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: "PDF has been generated and downloaded.",
      };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
    } catch (error) {
      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: `Error generating PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
    }
  };

  return (
    <main className="flex flex-col h-screen">
      <div className={cn("flex flex-col flex-grow", !hasStartedChat && "items-center justify-center")}>
        <div
          ref={scrollAreaRef}
          className={cn(
            hasStartedChat && "flex-grow overflow-y-auto w-full max-w-3xl mx-auto pt-4 px-4",
            hasStartedChat && "bg-neutral-900",
            !hasStartedChat && "flex justify-center items-center text-center"
          )}
        >
          <ChatMessages messages={messages} hasStartedChat={hasStartedChat} />
        </div>
        <div
          className={cn(
            "w-full",
            hasStartedChat && "flex-shrink-0 bg-neutral-900 pb-4 pt-2",
            !hasStartedChat && "mt-8"
          )}
        >
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSendMessage}
            disabled={isLoading}
            isPolicyMode={isPolicyMode}
            canGeneratePDF={canGeneratePDF}
            onGeneratePDF={handleGeneratePDF}
          />
        </div>
      </div>
    </main>
  );
}