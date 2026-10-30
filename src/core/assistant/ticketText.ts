import type { AiLanguage } from '@/core/api/chatbot';

// The chat's ticket flow (website: ui/TicketCard.jsx), in the language the
// shopper writes in. The `send*` lines go out as the shopper's message, so
// TICKET_YES / TICKET_NO below must recognise them.
const TEXT = {
  english: {
    title: 'Support ticket',
    photoAsk: 'Add a photo of the item (up to 3). It helps the seller check it faster.',
    addPhoto: 'Add photo',
    addAnother: 'Add another',
    noPhoto: 'No photo',
    raise: 'Raise ticket',
    notNow: 'Not now',
    sendRaise: 'Raise a ticket',
    sendNoPhoto: 'Raise a ticket without a photo',
    sendNotNow: 'Not now',
    askPhone: "What's the best phone number to reach you on for this ticket?",
    badPhone: "That doesn't look like a valid phone number. Please share a number our team can reach you on.",
    askEmail: 'And your email address? The team sends ticket updates there.',
    badEmail: "That doesn't look like a valid email address. Please check it and send it again.",
    raised: (order: string, photos: number) =>
      `Done — your ticket for Order #${order} is raised${photos ? ` with ${photos} photo${photos > 1 ? 's' : ''}` : ''}. Our team will reach out by email or phone soon.`,
    photoFailed: (order: string) =>
      `Your ticket for Order #${order} is raised, but the photos didn't upload. Open the ticket and add them with 📎.`,
    failed: "Sorry, I couldn't raise the ticket right now. Please try again in a bit.",
    noOrder: "I couldn't attach this to an order automatically. Please raise it from the Tickets page instead.",
    signIn: 'Please sign in so I can raise a ticket for your order.',
    declined: 'No problem — let me know if you’d like help with anything else.',
    reAsk: 'Would you like me to raise a support ticket for this?',
    openTicket: 'View my tickets',
    retry: 'Try again',
  },
  hinglish: {
    title: 'Support ticket',
    photoAsk: 'Item ki photo bhejo (3 tak). Isse seller jaldi check kar paayega.',
    addPhoto: 'Photo bhejo',
    addAnother: 'Ek aur photo',
    noPhoto: 'Photo nahi hai',
    raise: 'Ticket raise karo',
    notNow: 'Rehne do',
    sendRaise: 'Ticket raise karo',
    sendNoPhoto: 'Bina photo ke ticket raise karo',
    sendNotNow: 'Rehne do',
    askPhone: 'Is ticket ke liye aapka phone number kya hai?',
    badPhone: 'Ye phone number sahi nahi lag raha. Aisa number bhejo jispe team aapse baat kar sake.',
    askEmail: 'Aur aapka email? Ticket ki updates wahi aayengi.',
    badEmail: 'Ye email sahi nahi lag raha. Check karke dobara bhejo.',
    raised: (order: string, photos: number) =>
      `Ho gaya — Order #${order} ka ticket raise ho gaya${photos ? `, ${photos} photo ke saath` : ''}. Team jaldi email ya phone pe contact karegi.`,
    photoFailed: (order: string) =>
      `Order #${order} ka ticket raise ho gaya, par photo upload nahi ho paayi. Ticket kholke 📎 se add kar do.`,
    failed: 'Sorry, abhi ticket raise nahi ho paaya. Thodi der baad dobara try karo.',
    noOrder: 'Ye ticket order se apne aap nahi jud paaya. Tickets page se raise kar do.',
    signIn: 'Ticket raise karne ke liye pehle sign in karo.',
    declined: 'Koi baat nahi — aur kuch help chahiye toh batao.',
    reAsk: 'Kya main iske liye support ticket raise kar doon?',
    openTicket: 'Mere tickets',
    retry: 'Dobara try karo',
  },
  hindi: {
    title: 'सपोर्ट टिकट',
    photoAsk: 'सामान की फ़ोटो भेजें (3 तक)। इससे सेलर जल्दी जाँच कर पाएगा।',
    addPhoto: 'फ़ोटो भेजें',
    addAnother: 'एक और फ़ोटो',
    noPhoto: 'फ़ोटो नहीं है',
    raise: 'टिकट बनाएं',
    notNow: 'रहने दें',
    sendRaise: 'टिकट बनाएं',
    sendNoPhoto: 'बिना फ़ोटो के टिकट बनाएं',
    sendNotNow: 'रहने दें',
    askPhone: 'इस टिकट के लिए आपका फ़ोन नंबर क्या है?',
    badPhone: 'यह फ़ोन नंबर सही नहीं लग रहा। ऐसा नंबर भेजें जिस पर टीम आपसे बात कर सके।',
    askEmail: 'और आपका ईमेल? टिकट की जानकारी वहीं आएगी।',
    badEmail: 'यह ईमेल सही नहीं लग रहा। जाँच कर दोबारा भेजें।',
    raised: (order: string, photos: number) =>
      `हो गया — ऑर्डर #${order} का टिकट बन गया${photos ? `, ${photos} फ़ोटो के साथ` : ''}। टीम जल्द ईमेल या फ़ोन पर संपर्क करेगी।`,
    photoFailed: (order: string) =>
      `ऑर्डर #${order} का टिकट बन गया, पर फ़ोटो अपलोड नहीं हो पाई। टिकट खोलकर 📎 से जोड़ दें।`,
    failed: 'माफ़ कीजिए, अभी टिकट नहीं बन पाया। थोड़ी देर बाद फिर कोशिश करें।',
    noOrder: 'यह टिकट ऑर्डर से अपने आप नहीं जुड़ पाया। कृपया Tickets पेज से बनाएं।',
    signIn: 'टिकट बनाने के लिए पहले साइन इन करें।',
    declined: 'कोई बात नहीं — और कुछ मदद चाहिए तो बताएं।',
    reAsk: 'क्या मैं इसके लिए सपोर्ट टिकट बना दूं?',
    openTicket: 'मेरे टिकट',
    retry: 'फिर कोशिश करें',
  },
};

export type TicketText = (typeof TEXT)['english'];

export const ticketText = (language?: AiLanguage | null): TicketText => TEXT[language ?? 'english'] ?? TEXT.english;

// The chat asks for at most 3 photos (the server takes 5).
export const MAX_TICKET_PHOTOS = 3;

// Answers to the ticket offer (the widget's TICKET_*_REPLY_REGEX).
export const TICKET_AGENT = /human agent|connect.*agent|talk to (an? )?agent|speak to (an? )?agent|connect.*support/i;
export const TICKET_YES =
  /^(yes|yeah|yep|yup|sure|ok|okay|haan|haa|han|haanji|ji haan|bilkul|kar do)\b|raise a ticket|ticket raise kar|टिकट बनाएं|^(हाँ|हां|जी हाँ)/i;
export const TICKET_NO = /^(no|nah|nope|not now|no thanks?|nahi|nahin|mat karo|rehne do)\b|^(रहने दें|नहीं)/i;
export const TICKET_EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
