import { Storyteller } from '../models/models.js';

export const createStoryteller = async (storytellerData) => {
  try {
    const storyteller = new Storyteller(storytellerData);
    await storyteller.save();
    return storyteller;
  } catch (error) {
    console.error("Error creating storyteller:", error);
    throw error;
  }
};

export const getAllStorytellers = async () => {
  try {
    const storytellers = await Storyteller.find();
    return storytellers;
  } catch (error) {
    console.error("Error getting all storytellers:", error);
    throw error;
  }
};

export const getStorytellerByName = async (name) => {
  try {
    const storyteller = await Storyteller.findOne({ name });
    return storyteller;
  } catch (error) {
    console.error("Error getting storyteller by name:", error);
    throw error;
  }
};

export const updateStoryteller = async (name, updates) => {
  try {
    const storyteller = await Storyteller.findOneAndUpdate({ name }, updates, { new: true });
    return storyteller;
  } catch (error) {
    console.error("Error updating storyteller:", error);
    throw error;
  }
};

export const deleteStoryteller = async (name) => {
  try {
    const result = await Storyteller.deleteOne({ name });
    return result;
  } catch (error) {
    console.error("Error deleting storyteller:", error);
    throw error;
  }
};

export const upsertStoryteller = async (storytellerData) => {
  try {
    const storyteller = await Storyteller.findOneAndUpdate(
      { name: storytellerData.name },
      storytellerData,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return storyteller;
  } catch (error) {
    console.error("Error upserting storyteller:", error);
    throw error;
  }
};
