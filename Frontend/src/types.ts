export interface Message {
    id: string; // Unique identifier for React keys
    sender: "user" | "bot";
    text: string;
    // Add optional attachment info
    attachment?: {
        name: string;
        type: string; // Mime type or extension
    };
    // Add optional valid answers for bot messages (questions)
    validAnswers?: string;
}