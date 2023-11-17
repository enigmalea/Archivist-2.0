import { oneLine } from "common-tags";

// Constructs and exports the error message used when the link provided is not for an AO3Work.
const ao3WorkMessage = oneLine`That does not appear to be a link to an AO3 work.
	Please make sure you are linking to a work and not a series, author, collection,
	or using a non-AO3 link.`;
export const ao3WorkError = {
  content: ao3WorkMessage,
  ephemeral: true,
};

// Constructs and exports the error message used with the user must be authenticated to see a work.
const authMessage = oneLine`I'm sorry. This fic is available to Registered
	Users of AO3 only. In order to protect the author's privacy, I will not display
	an embed. Please go to AO3 directly while logged in to interact with this fic!`;
export const authError = {
  content: authMessage,
  ephemeral: true,
};