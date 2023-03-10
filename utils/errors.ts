import { stripIndents } from "common-tags";

export let ao3Work = {
    content: stripIndents`That does not appear to be a link to an AO3 work.
		Please make sure you are linking to a work and not a series, author, collection,
		or using a non-AO3 link.`,
    ephemeral: true,
};

export const authError = {
    content: stripIndents`I'm sorry. This fic is available to Registered
	Users of AO3 only. In order to protect the author's privacy, I will not display
	an embed. Please go to AO3 directly while logged in to view this fic!`,
    ephemeral: true,
};
