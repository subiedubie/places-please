// THE BOX OFFICE on screen: the free gift, today's deal and the shelves.
// The rules and prices are in meta/market.js and config/shop.js.
import { theme } from '../config/theme.js';
import { drawArt, hasArt } from './art.js';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const num = (n) => Number(n || 0).toLocaleString('en-US');

// A rendered picture from the atlas, or null if there is none by that name.
export function picture(name, size) {
  if (!hasArt(name)) return null;
  const c = document.createElement('canvas');
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  c.width = c.height = Math.round(size * dpr);
  c.style.width = c.style.height = size + 'px';
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  drawArt(g, name, size / 2, size / 2, size, size);
  return c;
}

// The one picture that stands for an item.
function itemPicture(reward, size) {
  const kinds = Object.keys(reward.boosters || {});
  let name = 'gift';
  if (kinds.length === 1) name = { spot: 'spot-h' }[kinds[0]] || kinds[0];
  else if (reward.packs) name = 'cardpack';
  else if (reward.boost) name = reward.boost.powers.includes('prism') ? 'prism-super' : 'show';
  return picture(name, size) || picture('gift', size) || el('span');
}

// session, the event screens (for their sheet and reward chips), and what to
// do after something changed (Home is drawn again).
export function createShopUi({ session, eventUi, confirm, onChange }) {
  let note = '';

  function priceButton(item, disabled) {
    const b = el('button', 'btn primary shop-buy' + (item.was ? ' deal' : ''));
    b.type = 'button';
    const coin = picture('coin', 18);
    if (coin) b.appendChild(coin);
    b.appendChild(el('span', '', num(item.price)));
    b.disabled = disabled;
    return b;
  }

  async function buy(item) {
    if (item.price >= 1000 && !(await confirm(`Buy ${item.title} for ${num(item.price)} coins?`, 'Buy', 'Cancel'))) return;
    const got = session.market.buy(item.id);
    if (!got) note = 'Not enough coins for that.';
    else if (got.cards && got.cards.length) note = 'You got: ' + got.cards.map((c) => c.name + (c.isNew ? ' (new)' : '')).join(', ');
    else note = `${item.title}: bought.`;
    onChange();
    eventUi.refreshSheet();
  }

  function card(item, coins) {
    const box = el('div', 'shop-item');
    const pic = el('div', 'shop-pic');
    pic.appendChild(itemPicture(item.reward, 54));
    if (item.owned !== null && item.owned !== undefined) pic.appendChild(el('span', 'shop-owned', String(item.owned)));
    box.append(pic, el('div', 'shop-name', item.title));
    const parts = Object.keys(item.reward.boosters || {}).length;
    if (parts > 1 || item.reward.boost || item.reward.packs > 1) box.appendChild(eventUi.renderReward(item.reward, 18));
    const b = priceButton(item, coins < item.price);
    b.onclick = () => buy(item);
    box.appendChild(b);
    return box;
  }

  function open() {
    note = '';
    eventUi.openSheet({
      render(body) {
        const v = session.market.view();
        const purse = el('div', 'shop-purse');
        const pile = picture('coin-stack', 34) || picture('coin', 30);
        if (pile) purse.appendChild(pile);
        purse.appendChild(el('span', 'shop-coins', num(v.coins)));
        body.appendChild(purse);
        if (note) body.appendChild(el('p', 'shop-note', note));

        const top = el('div', 'shop-top');
        const gift = el('div', 'shop-feature');
        gift.append(el('div', 'label', 'Free today'), itemPicture({ boosters: { a: 1, b: 1 } }, 56), eventUi.renderReward(v.gift.reward, 20));
        const take = el('button', 'btn primary shop-buy free', v.gift.ready ? 'Take it' : 'Tomorrow');
        take.type = 'button';
        take.disabled = !v.gift.ready;
        take.onclick = () => {
          if (session.market.takeGift()) note = 'Your free gift is in your boosters.';
          onChange();
          eventUi.refreshSheet();
        };
        gift.appendChild(take);
        const deal = el('div', 'shop-feature deal');
        deal.append(el('div', 'label', "Today's deal"), itemPicture(v.deal.reward, 56), el('div', 'shop-name', v.deal.title));
        const was = el('div', 'shop-was');
        was.append(el('s', '', num(v.deal.was)));
        deal.appendChild(was);
        const db = priceButton(v.deal, !v.deal.ready || v.coins < v.deal.price);
        if (!v.deal.ready) db.textContent = 'Sold out';
        db.onclick = () => buy(v.deal);
        deal.appendChild(db);
        top.append(gift, deal);
        body.appendChild(top);

        for (const shelf of v.shelves) {
          body.appendChild(el('div', 'label shop-shelf', shelf.name));
          const grid = el('div', 'shop-grid' + (shelf.items.length === 4 || shelf.items.length === 2 ? ' two' : ''));
          for (const it of shelf.items) grid.appendChild(card(it, v.coins));
          body.appendChild(grid);
        }
        return session.market.title;
      },
    });
  }

  // The button on Home's coins card, with a dot while the free gift is waiting.
  function home() {
    const b = document.getElementById('home-shop');
    if (!b) return;
    b.textContent = '';
    const pic = picture('shop', 34) || picture('coin', 28);
    if (pic) b.appendChild(pic);
    b.appendChild(el('span', '', 'Shop'));
    if (session.market.view().gift.ready) b.appendChild(el('span', 'shop-dot'));
    b.onclick = open;
  }

  void theme;
  return { open, home };
}
