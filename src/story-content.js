import { DEFAULT_OBJECT_ASSETS } from './object-library.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const localized = (standard, dialect) => ({ standard, dialect });
const asset = (id) => clone(DEFAULT_OBJECT_ASSETS.find((entry) => entry.id === id));

function decoration(assetId, id, x, y, overrides = {}) {
  const source = asset(assetId);
  return {
    id, assetId, name: source.name, type: source.type, x, y, width: source.width, height: source.height,
    color: source.color, label: source.label, layer: 'scenery', locked: false,
    appearance: source.appearance, spriteAnimation: source.appearance?.animations?.[0]?.id ?? '', animation: source.animation,
    ...(source.content ? { content: source.content, textStyle: source.textStyle } : {}), ...overrides,
  };
}

function textBlock(id, x, y, width, standard, dialect, color = '#f5e7bd') {
  return decoration('text-block', id, x, y, { width, content: localized(standard, dialect), color });
}

function eventFromAsset({ id, name, dialectName, message, dialectMessage, assetId, trigger, reward = 120, scope = 'level', x = 12.5, y = 18.5 }) {
  const source = asset(assetId);
  return {
    id, kind: 'easter-egg', name: localized(name, dialectName), message: localized(message, dialectMessage), reward, scope, trigger,
    visual: {
      type: 'custom', x, y, color: source.color, accent: '#f5c451', label: source.label, visibility: 'after-trigger',
      assetId, appearance: source.appearance, spriteAnimation: source.appearance?.animations?.[0]?.id ?? '', animation: source.animation,
    },
  };
}

const camera = (keyframes) => ({ id: 'camera', type: 'camera', target: 'camera', keyframes });
const actor = (id, target, keyframes) => ({ id, type: 'actor', target, keyframes });
const object = (id, target, keyframes) => ({ id, type: 'object', target, keyframes });
const dialogue = (keyframes) => ({ id: 'dialogue', type: 'dialogue', target: 'dialogue', keyframes });
const cam = (id, time, x, y, zoom, easing = 'ease-in-out') => ({ id, time, x, y, zoom, easing });
const pose = (id, time, x, y, state = 'idle', easing = 'linear', visible = true, animation = '') => ({ id, time, x, y, state, easing, visible, animation });
const line = (id, time, duration, speaker, standard, dialect) => ({ id, time, duration, speaker, text: localized(standard, dialect), easing: 'step' });

export function storyContent(levelId, player = { x: 12, y: 20 }) {
  const p = player;
  const stories = {
    home: {
      decorations: [decoration('brahmahof-mailbox', 'briefkasten-30', 15, 16), textBlock('adresse-bramerhof', 7, 3, 11, 'Am Bramerhof 30', 'Am Bramerhof 30')],
      event: eventFromAsset({ id: 'post-fuer-franz', name: 'Geburtstagspost', dialectName: 'Geburtstagspost', message: 'Im Briefkasten wartet Geburtstagspost für Franz.', dialectMessage: 'Im Briefkastl wart a Geburtstagspost aufn Franz.', assetId: 'brahmahof-mailbox', trigger: { type: 'zone', zones: [{ x: 14, y: 16, width: 3, height: 3 }] }, reward: 130, x: 15.5, y: 16.5 }),
      cutscene: { id: 'intro', kind: 'intro', name: localized('Aufbruch am Bramerhof', 'Aufbruch am Bramerhof'), duration: 4, skippable: true, tracks: [
        camera([cam('haus', 0, 12, 8, 1.45), cam('start', 4, p.x, p.y, 1.12)]),
        actor('franz-lola', 'player', [pose('tritt-raus', 0, 11, 16, 'down'), pose('bereit', 4, p.x, p.y)]),
        object('briefkasten', 'briefkasten-30', [pose('still', 0, 15, 16), pose('wackelt', 1.4, 15, 15.75, 'idle', 'ease-in-out'), pose('still-2', 2.1, 15, 16)]),
        dialogue([line('lola-wartet', 0.8, 2.4, 'Franz', 'Lola, die Runde beginnt direkt vor unserer Haustür.', 'Lola, unsre Rundn fangt direkt vor da Haustür o.')]),
      ] },
    },
    hals: {
      decorations: [decoration('river-spark', 'ilz-funkeln', 1, 10), textBlock('hals-schild', 8, 3, 9, 'Hals · an der Ilz', 'Hals · an da Ilz', '#b7eef0')],
      event: eventFromAsset({ id: 'ilzrauschen', name: 'Das Rauschen der Ilz', dialectName: 'S Rauschn vo da Ilz', message: 'Die Ilz erzählt heute besonders laut von Hals.', dialectMessage: 'D Ilz vazählt heid bsonders laut vom Hois.', assetId: 'river-spark', trigger: { type: 'time', seconds: 18 }, reward: 110, x: 1.5, y: 10.5 }),
      cutscene: { id: 'intro', kind: 'intro', name: localized('Entlang der Ilz', 'Entlang vo da Ilz'), duration: 5.2, skippable: true, tracks: [
        camera([cam('fluss', 0, 1.5, 11, 1.6), cam('hals', 2.5, 12, 9, 1.28), cam('gassi', 5.2, p.x, p.y, 1.12)]),
        actor('franz-lola', 'player', [pose('am-ufer', 0, 5, 18, 'right'), pose('einmarsch', 3.7, 10, 18, 'right'), pose('bereit', 5.2, p.x, p.y)]),
        object('wasserlicht', 'ilz-funkeln', [pose('auftauchen', 0, 1, 11, 'idle', 'linear', false), pose('funkeln', 0.7, 1, 10, 'idle', 'ease-in-out', true, 'idle')]),
        dialogue([line('ilz', 0.4, 2.1, 'Franz', 'Da glitzert die Ilz – Lola hat es natürlich zuerst gesehen.', 'Do glitzert d Ilz – d Lola hods natürlich zerscht gsegn.'), line('los', 3.1, 1.5, 'Franz', 'Dann auf nach Hals!', 'Dann auf nach Hois!')]),
      ] },
    },
    bschuett: {
      decorations: [decoration('bench', 'bschuett-bank', 6, 15), textBlock('park-regel', 8, 4, 9, 'Skaten · Spielen · Gassi', 'Skaten · Spuin · Gassi', '#8fcfa8')],
      event: eventFromAsset({ id: 'lolas-stockerl', name: 'Lolas Superstöckchen', dialectName: 'D Lolas Supersteckerl', message: 'Lola hat das beste Stöckchen im ganzen Bschüttpark gefunden.', dialectMessage: 'D Lola hod s beste Steckerl im ganzen Bschüttpark gfundn.', assetId: 'lola-stick', trigger: { type: 'direction-sequence', sequence: ['left', 'right', 'left', 'right', 'up'] }, reward: 140, x: 7, y: 15.5 }),
      cutscene: { id: 'intro', kind: 'intro', name: localized('Runde durch den Bschüttpark', 'Rundn durch an Bschüttpark'), duration: 4.8, skippable: true, tracks: [
        camera([cam('park', 0, 12, 12, 1.38), cam('bank', 2, 7, 15, 1.42), cam('start', 4.8, p.x, p.y, 1.12)]),
        actor('franz-lola', 'player', [pose('kommt', 0, 9, 20, 'right'), pose('wartet', 3.1, 12, 20, 'idle'), pose('start', 4.8, p.x, p.y)]),
        actor('neugierige-katze', 'cat:0', [pose('schaut', 0, 7, 14, 'down'), pose('flitzt', 3.2, 11, 12, 'right')]),
        dialogue([line('park', 0.7, 2.2, 'Franz', 'Im Bschüttpark ist heute ordentlich etwas los.', 'Im Bschüttpark is heid gscheid wos los.'), line('lola', 3.2, 1.2, 'Franz', 'Lola, das Stöckchen bleibt liegen!', 'Lola, des Steckerl bleibt liegn!')]),
      ] },
    },
    dom: {
      decorations: [decoration('cathedral-bell', 'domglocke-objekt', 11, 3), textBlock('dom-tafel', 7, 6, 11, 'Dom St. Stephan', 'Dom St. Stephan', '#f1d05c')],
      event: eventFromAsset({ id: 'orgelakkord', name: 'Der große Orgelakkord', dialectName: 'Da große Orgelakkord', message: 'Ein tiefer Akkord rollt über den Domplatz.', dialectMessage: 'A tiafa Akkord rollt üban Domplatz.', assetId: 'cathedral-bell', trigger: { type: 'time', seconds: 12 }, reward: 180, x: 12, y: 4 }),
      cutscene: { id: 'intro', kind: 'intro', name: localized('Glocken über Passau', 'Glockn über Passau'), duration: 5.6, skippable: true, tracks: [
        camera([cam('turm', 0, 12, 2, 1.72), cam('glocke', 1.8, 12, 4, 1.52), cam('platz', 3.8, 12, 14, 1.25), cam('start', 5.6, p.x, p.y, 1.12)]),
        object('glockenschwung', 'domglocke-objekt', [pose('links', 0, 11, 3, 'idle', 'linear', true, 'idle'), pose('rechts', 0.7, 12, 3, 'idle', 'ease-in-out'), pose('mitte', 1.4, 11, 3, 'idle', 'ease-in-out')]),
        actor('franz-lola', 'player', [pose('domplatz', 0, 12, 18, 'up'), pose('blickt', 3.8, 12, 18, 'idle'), pose('start', 5.6, p.x, p.y)]),
        dialogue([line('bim', 0.4, 1.6, 'Domglocke', 'Bim. Bam.', 'Bim. Bam.'), line('franz', 2.4, 2.2, 'Franz', 'Lola, selbst die Glocken wünschen eine gute Runde.', 'Lola, sogar d Glockn wünschen uns a guade Rundn.')]),
      ] },
    },
    dreifluesseeck: {
      decorations: [decoration('river-spark', 'drei-fluesse-funkeln', 21, 10), textBlock('flussnamen', 6, 3, 13, 'Donau · Inn · Ilz', 'Donau · Inn · Ilz', '#8ce5ec')],
      event: eventFromAsset({ id: 'dreiklang-der-fluesse', name: 'Dreiklang der Flüsse', dialectName: 'Dreiklang vo de Fliss', message: 'Inn, Ilz und Donau funkeln gleichzeitig.', dialectMessage: 'Inn, Ilz und Donau funkeln olle drei auf amoi.', assetId: 'river-spark', trigger: { type: 'zone', zones: [{ x: 20, y: 9, width: 3, height: 3 }] }, reward: 210, x: 21.5, y: 10.5 }),
      cutscene: { id: 'intro', kind: 'intro', name: localized('Drei Flüsse, eine Runde', 'Drei Fliss, oane Rundn'), duration: 6.4, skippable: true, tracks: [
        camera([cam('donau', 0, 2, 7, 1.52), cam('inn', 1.5, 8, 22, 1.45), cam('ilz', 3, 22, 9, 1.5), cam('mitte', 4.6, 12, 12, 1.23), cam('start', 6.4, p.x, p.y, 1.12)]),
        object('flussreflex', 'drei-fluesse-funkeln', [pose('donau', 0, 1, 7), pose('inn', 1.5, 8, 22, 'idle', 'ease-in-out'), pose('ilz', 3, 21, 10, 'idle', 'ease-in-out')]),
        actor('franz-lola', 'player', [pose('aussicht', 0, 12, 18, 'up'), pose('dreht', 4.6, 12, 18, 'right'), pose('start', 6.4, p.x, p.y)]),
        dialogue([line('donau', 0.2, 1.2, 'Franz', 'Die Donau.', 'D Donau.'), line('inn', 1.7, 1.1, 'Franz', 'Der Inn.', 'Da Inn.'), line('ilz', 3.2, 1.1, 'Franz', 'Und natürlich die Ilz.', 'Und natürlich d Ilz.'), line('lola', 4.7, 1.4, 'Franz', 'Lola interessiert sich trotzdem mehr für Guttis.', 'D Lola interessiert si trotzdem mehr für Guttis.')]),
      ] },
    },
    oberhaus: {
      decorations: [decoration('oberhaus-flag', 'oberhaus-fahne', 17, 4), textBlock('oberhaus-banner', 7, 7, 11, 'Veste Oberhaus', 'Veste Oberhaus', '#f1d05c')],
      event: eventFromAsset({ id: 'goldener-ausblick', name: 'Goldener Passau-Blick', dialectName: 'Goldana Passau-Blick', message: 'Von hier oben leuchtet ganz Passau.', dialectMessage: 'Vo do herob leucht ganz Passau.', assetId: 'oberhaus-flag', trigger: { type: 'direction-sequence', sequence: ['up', 'up', 'up', 'right', 'left'] }, reward: 190, x: 18, y: 5 }),
      cutscene: { id: 'intro', kind: 'intro', name: localized('Hinauf zur Veste', 'Auffi zur Veste'), duration: 5, skippable: true, tracks: [
        camera([cam('stadt', 0, 12, 21, 1.4), cam('aufstieg', 2.2, 15, 11, 1.35), cam('fahne', 3.5, 18, 5, 1.55), cam('start', 5, p.x, p.y, 1.12)]),
        actor('franz-lola', 'player', [pose('unten', 0, 9, 21, 'up'), pose('aufstieg', 2.5, 14, 16, 'up'), pose('start', 5, p.x, p.y)]),
        object('fahne', 'oberhaus-fahne', [pose('wind-links', 0, 17, 4), pose('wind-rechts', 1, 17.35, 4, 'idle', 'ease-in-out'), pose('wind-mitte', 2, 17, 4, 'idle', 'ease-in-out')]),
        dialogue([line('schnaufen', 1.1, 1.6, 'Franz', 'Ein kleiner Aufstieg, sagt die Lola.', 'A kloana Aufstieg, sagt d Lola.'), line('blick', 3.3, 1.5, 'Franz', 'Aber der Blick lohnt sich.', 'Aber da Blick lohnt si.')]),
      ] },
    },
    uni: {
      decorations: [decoration('university-book', 'uni-buch', 15, 12), textBlock('campus-tafel', 7, 4, 11, 'Campus an der Innstraße', 'Campus an da Innstraßn', '#b7eef0')],
      event: eventFromAsset({ id: 'pruefungs-gutti', name: 'Das Prüfungs-Gutti', dialectName: 'S Prüfungs-Gutti', message: 'Dieses Gutti besteht jede Prüfung mit Auszeichnung.', dialectMessage: 'Des Gutti besteht a jede Prüfung mit Auszeichnung.', assetId: 'university-book', trigger: { type: 'zone', zones: [{ x: 14, y: 11, width: 3, height: 3 }] }, reward: 160, x: 16, y: 13 }),
      cutscene: { id: 'intro', kind: 'intro', name: localized('Kurze Vorlesung für Lola', 'A kurze Vorlesung für d Lola'), duration: 4.3, skippable: true, tracks: [
        camera([cam('campus', 0, 12, 8, 1.32), cam('buch', 1.6, 16, 13, 1.58), cam('start', 4.3, p.x, p.y, 1.12)]),
        object('buch', 'uni-buch', [pose('zu', 0, 15, 12), pose('auf', 1.1, 15, 11.7, 'idle', 'ease-in-out', true, 'idle'), pose('zurueck', 2.2, 15, 12)]),
        actor('franz-lola', 'player', [pose('studenten', 0, 10, 18, 'right'), pose('start', 4.3, p.x, p.y)]),
        dialogue([line('vorlesung', 1.1, 2.3, 'Franz', 'Thema heute: angewandte Gutti-Kunde.', 'Thema heid: ogwandte Gutti-Kund.'), line('lola', 3.5, 0.7, 'Lola', 'Wuff!', 'Wuff!')]),
      ] },
    },
    tabakfabrik: {
      decorations: [decoration('factory-steam', 'fabrikdampf', 6, 3), textBlock('fabrik-tafel', 7, 8, 11, 'Kultur in der Tabakfabrik', 'Kultur in da Tabakfabrik', '#f0d0a0')],
      event: eventFromAsset({ id: 'dampfzeichen', name: 'Das alte Dampfzeichen', dialectName: 'S oide Dampfzeichen', message: 'Über dem Schornstein erscheint ein kleines Dampfzeichen.', dialectMessage: 'Überm Kamin kimmt a kloans Dampfzeichen.', assetId: 'factory-steam', trigger: { type: 'time', seconds: 15 }, reward: 150, x: 7, y: 4 }),
      cutscene: { id: 'intro', kind: 'intro', name: localized('Die Fabrik erwacht', 'D Fabrik wacht auf'), duration: 5.8, skippable: true, tracks: [
        camera([cam('schornstein', 0, 7, 3, 1.62), cam('fassade', 2, 12, 9, 1.36), cam('tor', 4, 12, 16, 1.28), cam('start', 5.8, p.x, p.y, 1.12)]),
        object('dampf', 'fabrikdampf', [pose('unsichtbar', 0, 6, 4, 'idle', 'linear', false), pose('wolke-1', 0.6, 6, 3, 'idle', 'ease-in-out', true, 'idle'), pose('wolke-2', 2.2, 7, 1.5, 'idle', 'ease-in-out', true, 'idle')]),
        actor('franz-lola', 'player', [pose('tor', 0, 10, 18, 'right'), pose('start', 5.8, p.x, p.y)]),
        actor('fabrik-katze', 'cat:1', [pose('lauert', 0, 15, 15, 'left'), pose('verschwindet', 4.2, 19, 15, 'right')]),
        dialogue([line('dampf', 0.7, 1.8, 'Franz', 'Die alte Fabrik gibt noch immer Zeichen.', 'D oide Fabrik gibt no oiwei Zeichen.'), line('katze', 3, 1.7, 'Franz', 'Und eine Katze hat Nachtschicht.', 'Und a Katz hod Nachtschicht.')]),
      ] },
    },
    zauberberg: {
      decorations: [decoration('zauberberg-note', 'zauberberg-note-frei', 11, 8), decoration('concert-speaker', 'zauberberg-box', 17, 11), textBlock('konzertplakat', 7, 3, 11, 'ROCK · PUNK · METAL', 'ROCK · PUNK · METAL', '#ffb4d0')],
      event: eventFromAsset({ id: 'zugabe', name: 'Zauberberg-Zugabe', dialectName: 'Zauberberg-Zuagab', message: 'Die Bühne spielt eine Zugabe nur für Franz und Lola.', dialectMessage: 'D Bühn spuit a Zuagab bloß fürn Franz und d Lola.', assetId: 'zauberberg-note', trigger: { type: 'direction-sequence', sequence: ['up', 'up', 'down', 'left', 'right'] }, reward: 260, x: 12, y: 9 }),
      cutscene: { id: 'intro', kind: 'intro', name: localized('Soundcheck am Zauberberg', 'Soundcheck am Zauberberg'), duration: 7.2, skippable: true, tracks: [
        camera([cam('dunkel', 0, 12, 15, 1.05), cam('licht-links', 1.2, 8, 8, 1.48), cam('licht-rechts', 2.4, 17, 8, 1.48), cam('note', 3.8, 12, 9, 1.7), cam('band', 5.4, 12, 13, 1.3), cam('start', 7.2, p.x, p.y, 1.12)]),
        actor('franz-lola', 'player', [pose('backstage', 0, 8, 18, 'right', 'linear', false), pose('eintritt', 1.5, 8, 18, 'right', 'linear', true), pose('mitte', 5.4, 12, 18, 'up'), pose('start', 7.2, p.x, p.y)]),
        object('note-solo', 'zauberberg-note-frei', [pose('still', 0, 11, 8, 'idle', 'linear', false), pose('einsatz', 2.8, 11, 9, 'idle', 'ease-in-out', true, 'idle'), pose('hoch', 3.8, 11, 7.5, 'idle', 'ease-in-out', true, 'idle'), pose('runter', 4.8, 11, 9, 'idle', 'ease-in-out', true, 'idle')]),
        object('bassbox', 'zauberberg-box', [pose('still', 0, 17, 11), pose('bass-1', 1.5, 16.8, 11), pose('bass-2', 2, 17.2, 11), pose('still-2', 2.5, 17, 11)]),
        actor('rock-katze', 'cat:2', [pose('buehne-links', 0, 7, 12, 'right'), pose('buehne-rechts', 5.4, 17, 12, 'right', 'ease-in-out')]),
        dialogue([line('soundcheck', 0.5, 1.5, 'Technik', 'Licht an. Boxen an.', 'Licht o. Boxn o.'), line('musik', 2.5, 1.8, 'Franz', 'Rock, Punk und Metal – Lola, das ist unsere Bühne.', 'Rock, Punk und Metal – Lola, des is unsre Bühn.'), line('katze', 5.1, 1.5, 'Franz', 'Nur die Vorband sieht verdächtig nach Katze aus.', 'Bloß d Vorband schaut verdächtig noch Katz aus.')]),
      ] },
    },
  };
  return clone(stories[levelId] ?? { decorations: [], event: null, cutscene: null });
}
