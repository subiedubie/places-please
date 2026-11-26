// The side games that have their own play screen, by the `game.kind` their
// event view carries (meta/events/<type>.js). Each opens full screen.
// Each also registers its round badge for Home (ui/eventicons.js).
import { openDig } from './dig.js';
import { openFirewalk } from './firewalk.js';
import { openArchery } from './archery.js';
import { openPairs } from './pairs.js';
import { openCannon } from './cannon.js';
import { openPlinko } from './plinko.js';
import { openPass } from './pass.js';
import { openControl } from './control.js';
import { openPursuit } from './pursuit.js';
import { openTournament } from './tournament.js';
import { openCircuit } from './circuit.js';
import { openBattle } from './battle.js';
import { openBoard } from './board.js';
import { openLanes } from './lanes.js';
import { openClimb } from './climb.js';
import { openPot } from './pot.js';
import { openBalloon } from './balloon.js';
import { openPinata } from './pinata.js';
import { openTour } from './tour.js';
import { addPicture } from '../eventicons.js';
import { hammer, TAU } from './kit.js';
export { useRewardChips } from './kit.js';

export const GAMES = {
  dig: openDig,
  firewalk: openFirewalk,
  archery: openArchery,
  pairs: openPairs,
  cannon: openCannon,
  plinko: openPlinko,
  pass: openPass,
  control: openControl,
  pursuit: openPursuit,
  tournament: openTournament,
  circuit: openCircuit,
  battle: openBattle,
  board: openBoard,
  lanes: openLanes,
  climb: openClimb,
  pot: openPot,
  balloon: openBalloon,
  pinata: openPinata,
  tour: openTour,
};

// Badges, drawn out of 100.
addPicture('dig', {
  types: ['dig'],
  colors: ['#c0702a', '#5a2400'],
  badge: ['#ffe9c8', '#d8a060'],
  paint(ctx) {
    ctx.fillStyle = '#c89058';
    ctx.strokeStyle = '#5a3010';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(18, 46, 64, 36, 8) : ctx.rect(18, 46, 64, 36);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff3a5a';
    ctx.beginPath();
    ctx.moveTo(50, 50); ctx.lineTo(62, 60); ctx.lineTo(50, 76); ctx.lineTo(38, 60); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a0020';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath(); ctx.arc(46, 58, 3, 0, TAU); ctx.fill();
    hammer(ctx, 62, 34, 40, 0.5);
  },
});

addPicture('lives', {
  types: ['lives'],
  colors: ['#ff2a55', '#7a0020'],
  badge: ['#ffe0e6', '#f08aa0'],
  paint(ctx) {
    ctx.fillStyle = '#ff2a55';
    ctx.strokeStyle = '#7a0020';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(50, 82);
    ctx.bezierCurveTo(4, 52, 14, 14, 50, 34);
    ctx.bezierCurveTo(86, 14, 96, 52, 50, 82);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.65)';
    ctx.beginPath();
    ctx.ellipse(34, 40, 8, 5, -0.6, 0, TAU);
    ctx.fill();
  },
});

addPicture('team', {
  types: ['team'],
  colors: ['#2a8ad8', '#0a3a7a'],
  badge: ['#dff0ff', '#8ab8e8'],
  paint(ctx) {
    const head = (x, y, r, c) => {
      ctx.fillStyle = c;
      ctx.strokeStyle = '#1a2a5a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y + r * 2.3, r * 1.5, Math.PI, 0); ctx.fill(); ctx.stroke();
    };
    head(30, 40, 9, '#7ac0ff');
    head(70, 40, 9, '#ffb04a');
    head(50, 34, 12, '#ff6a9a');
  },
});
