const mockResponses = [
    {
      reply: "Ah, yes — your file is already prepared and awaiting dispatch. The typewriter model you've been assigned is... uncommon.",
      has_chat_ended: true
    },
    {
      reply: "You'll find the first key has changed. Please do not press it yet.",
      has_chat_ended: false
    },
    {
      reply: "Transmission stability fluctuates slightly at this hour. No cause for concern.",
      has_chat_ended: false
    },
    {
      reply: "You’ll know what to do once the curtain falls.",
      has_chat_ended: true
    }
  ];
  
  let mockIndex = 0;
  function getMockResponse() {
    const response = mockResponses[mockIndex % mockResponses.length];
    mockIndex++;
    return {
      message_assistant: response.reply,
      has_chat_ended: response.has_chat_ended
    };
  }
  
  export { getMockResponse };