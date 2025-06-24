// This file will contain prompts related to book generation and processing.

export function askForBooksGeneration(){
    const prompt = `do you think you can think of a list of like 10 different books, parchments, maps etc...
    various medium of writings that could be found in the premises of the master storyteller
    that could be relevant to the client.
    The master storyteller detective suggests the list of the books to the client.
    then the client would need to choose  4 out of them. (all the writings are taken from this storytelling universe we're talking about).
    please return the result in this JSON format. so it could be parsed by JSON.parse():
    {"storyteller_response": String, "book_list":[{"book_title":String, "book_description":String}]}`
    return [{ role: "system", content: prompt }];
}
