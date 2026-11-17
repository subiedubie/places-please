// PLAYBILL: the monthly card album. Nine plays (sets), nine cards each.
// A new album starts on the 1st of every month.

export const ALBUM = {
  title: 'Playbill',

  // How many cards a pack holds: between these two numbers.
  packSize: [3, 5],

  // How likely each star rating is when a card is drawn. Bigger = more
  // often. (60 : 25 : 10 : 4 : 1 means a 5-star card is about 1 draw in 100.)
  starWeights: { 1: 60, 2: 25, 3: 10, 4: 4, 5: 1 },

  // Coins paid for a card you already have, by its stars.
  duplicateCoins: { 1: 5, 2: 10, 3: 25, 4: 60, 5: 150 },

  // Paid once when all nine cards of a set are owned.
  setReward: { coins: 1000, boosters: { spot: 1, show: 1 } },

  // Paid once when all 81 cards are owned.
  grandPrize: { coins: 20000, boosters: { prism: 3, drill: 3 }, boost: { powers: ['prism', 'show', 'spot-h'], minutes: 120 } },

  // The stars of the nine cards in each set, in order. Early sets are easy
  // to finish; the last ones hold the rare cards.
  sets: [
    {
      name: 'The Lighthouse Keeper\'s Daughter',
      stars: [1, 1, 1, 1, 1, 2, 2, 2, 3],
      cards: ['The Lamp Room', 'Storm Bell', 'Oilskin Coat', 'Spiral Stair', 'Gull on the Rail', 'The Logbook', 'Rowboat at Dawn', 'The Letter in the Bottle', 'First Light'],
    },
    {
      name: 'A Fiddle for the Mayor',
      stars: [1, 1, 1, 1, 2, 2, 2, 3, 3],
      cards: ['Town Square', 'The Borrowed Fiddle', 'Ribbon Cutting', 'Brass Band', 'The Mayor\'s Sash', 'Dancing Shoes', 'Lost Sheet Music', 'The Midnight Reel', 'Key to the City'],
    },
    {
      name: 'Tea at the End of the Line',
      stars: [1, 1, 1, 2, 2, 2, 3, 3, 4],
      cards: ['Station Clock', 'Chipped Teapot', 'The Last Timetable', 'Porter\'s Cap', 'Window Seat', 'The Missed Train', 'Steam on the Platform', 'Two Tickets', 'The Stationmaster\'s Toast'],
    },
    {
      name: 'The Clockmaker\'s Apprentice',
      stars: [1, 1, 1, 2, 2, 3, 3, 4, 4],
      cards: ['Workbench', 'Loupe and Tweezers', 'Mainspring', 'The Cuckoo Door', 'Brass Gears', 'Pendulum', 'The Stopped Hour', 'Moonphase Dial', 'The Masterpiece'],
    },
    {
      name: 'Moon Over the Orchard',
      stars: [1, 1, 2, 2, 2, 3, 3, 4, 4],
      cards: ['Picking Ladder', 'Bushel Basket', 'Cider Press', 'Paper Moon', 'The Scarecrow\'s Waltz', 'Harvest Supper', 'Lantern in the Branches', 'The Proposal', 'First Frost'],
    },
    {
      name: 'The Understudy Goes On',
      stars: [1, 1, 2, 2, 3, 3, 3, 4, 5],
      cards: ['Half-Hour Call', 'Borrowed Costume', 'The Prompt Corner', 'Greasepaint', 'Stage Fright', 'The Missed Cue', 'Flowers at the Stage Door', 'Standing Ovation', 'Name in Lights'],
    },
    {
      name: 'Seven Hats for Señora Luz',
      stars: [1, 2, 2, 2, 3, 3, 4, 4, 5],
      cards: ['The Hat Shop', 'Straw Boater', 'Feathered Cloche', 'Hatpin', 'The Wedding Veil', 'Top Hat Trick', 'The Sunday Parade', 'Wind on the Bridge', 'The Seventh Hat'],
    },
    {
      name: 'The Paper Lantern Opera',
      stars: [1, 2, 2, 3, 3, 3, 4, 4, 5],
      cards: ['Overture', 'Rice-Paper Screen', 'The River Boat', 'Shadow Puppets', 'Aria at Dusk', 'The Fan Dance', 'A Thousand Lanterns', 'The Painted Bridge', 'Finale by Firelight'],
    },
    {
      name: 'Curtain at Midnight',
      stars: [2, 2, 3, 3, 3, 4, 4, 5, 5],
      cards: ['Empty House', 'The Ghost Light', 'Velvet Rope', 'Trap Door', 'The Phantom Usher', 'Masquerade', 'The Chandelier', 'The Last Bow', 'Final Curtain'],
    },
  ],
};
