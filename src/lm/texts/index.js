import history from "./history.js";
import biology from "./biology.js";
import cricket from "./cricket.js";
import cooking from "./cooking.js";
import space from "./space.js";
import folktales from "./folktales.js";
import { tokenize, isWord } from "../tokenize.js";

const withWords = (t) => ({ ...t, words: tokenize(t.text).filter(isWord).length });
export const STARTER_TEXTS = [history, biology, cricket, cooking, space, folktales].map(withWords);
export const HISTORY_TEXT = history.text;
export const getText = (id) => STARTER_TEXTS.find((t) => t.id === id);
