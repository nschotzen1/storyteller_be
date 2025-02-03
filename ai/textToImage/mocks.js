const optionsMock = {
    "question": "What motivates you to wake up before dawn, as the cold, biting air of the mountains chills your bones?", 
    'options':[
      {
      "title":"Sense of Duty", 
      "description":"In your heart, you can feel a strong sense of duty and responsibility towards the fort. You believe in serving your role as a guard solemnly, safeguarding those who take refuge within the fort walls.",
      "category":"Character's Motivations", 
      "subcategory":"Duty-driven",
      "illustration":"Picture a guard, standing tall and resolute facing the windswept plains, bathed in the dim, icy blue pre-dawn light. Hair fluttering against the gusts, a determined gaze fixed afar. The silvering frost of dawn on their collar underlining the severity of their duty. Their body draped in thick, rustic armor, and a long, double-edged sword in hand. Mountains shadow their silhouette, their imposing presence completing the atmosphere of cold resolve.",
      "font":"Noto Sans font"
      },
      {
      "title":"Adventure's Call", 
      "description":"With the rising of the sun, you yearn for the wilderness that lies beyond the comfort of the fort's walls. The unpredictable nature of the unknown captivates you, making every new day an opportunity for discovery.",
       "category":"Character's Motivations", 
      "subcategory":"Adventure-seeker",
      "illustration":"Imagine an adventurer, in a lighter, flexible attire ready for the hardships of an outdoor life. A bow slung across the shoulder symbolizing their reliance on skill rather than brute force. Face towards the sky in anticipation, eyes lit with excitement and gear packed for the journey ahead. They stand on the edge of the fort wall, overlooking the rocky terrain, the first rays of sunlight painting them in a hopeful glow.",
      "font":"Noto Sans font"
      },
      { 
      "title":"Vengeance's Flame", 
      "description":"A wrong done to you or a loved one years ago still haunts your dreams. The desire to bring justice or seek vengeance, to right that which was wronged, drives you each day.",
       "category":"Character's Motivations", 
      "subcategory":"Vengeance-seeker",
      "illustration":"Depict a figure clad in cold, dark armor, the frost-touched shades reflecting their steely intent for revenge. Fist clenched tight around the hilt of a tarnished, battle-worn sword. Face masked with determination, their eyes exuding an ethereal glow, flaring up with the flame of vengeance. The icy valley behind them is dark, signifying the past that haunts them, a silent night sky full of stars their only witness.",
      "font":"Noto Sans font"
      }
      ]
    }


// const texturePrompts = [
    //     `Card texture: Inspired by the Nordic sagas and the ambiance of The Witcher series, cool steel grays contrast with deep crimson stains. Ancient runic patterns glow faintly, like long-forgotten prophecies, with touches of worn leather in the corners. The texture embodies a sense of melancholy and valiance, with a finely-grained, parchment-like surface, exuding archetypal warrior grit, 8k, ArtStation winner`
    // ];
    // const boo = await textToImage(texturePrompts[0]);
    // console.log(boo); // This will print the mock value "Texture Image Path"
    const prompt1 = `I admit it, seeing the dark woods for the first time was scary. but after the first time I came there with my friends, I got connected to the forest so deep that I came there every day after school. Dried leaves rustled underfoot as I followed a flattened path deeper each day.
    after a few days of getting deeper following the path I spotted A deserted mansion Finger-traced dust unveiled '1902' etched into the cornerstone. I started running towards my house to call my friends but I tripped and fell. And when I woke up I was in the cabin in the middle of the forest and I tried to get up but I couldn't because of a sharp pain in my leg A myriad of footprints, all leading to a rickety wooden desk. Suddenly, I heard the door creak, and opening and an old man stepped in. He went to the desk and he took something not ordinary from there. and told me: "Oh finally, you woke up!". Splattered with leeching ink, a parchment map unfurled, held by his gnarled arthritis-ridden hands. "I need you to help me  you're stronger. I wanna know what's behind the waterfall ridge. I need it for my map".`
    // const res = await generateTextureOptionsByText(prompt1)
    console.log('asdf')

    // const prompt = `Create a full-frame illustration for the front side of a virtual RPG character creation card. The card, titled 'A Wisp Lantern' in Noto Sans font. (and this is the ONLY readable text in this illustration) please create this front full frame illustration out of this description: "llustration': 'Bathed in soft, icy blue light, the lantern feels alive, its texture reminiscent of the crystalline formation of frost. The wisp trapped inside dances like a flickering flame, casting long, intricate shadows over the wind-etched silver and sapphire backdrop, adding to the mysterious undertones of the RPG world.' and also reference this: "An ethereal lantern, seemingly made from the chill of the mountaintop itself. Within its crystal-clear enclosure, a blue wisp flickers restlessly, providing a reclusive yet unwavering light, likely to come handy when navigating through the darkness.". The design should fill the entire frame. No additional text besides the title.
    // the back side of the card is generated by this prompt: "Card texture: Channeling the haunting beauty of Art Nouveau entwined with the chilling mystique of Siberian folklore, envision a backdrop swirling with icy blues and silvers. The edges of the card give the impression of frost creeping in, while delicate filigree designs, reminiscent of icicles, drape from the top and bottom. Central to this is an archetypal emblem of a mountain, surrounded by flourishes that suggest gusts of wind and snow. The design encapsulates the cold, mysterious aura of the Bear's Fang Summit and the secrets of the Ancient Lighthouse, all in an RPG essence."". I want the front side to have the same artistic influences and theme. the use of embellishments etc.
    // Remember, the design should fill the WHOLE frame. it's a full frame illustration!! make it epic.  size 1024X1024. artStation winner. cinematic. inspiring and inviting to discover a hero through the process of choosing cards. make it a bit rough, grainy, cinematic, impressionistic. RPG core game book alternative nische award winning. one time. collector's only. remember the only VISIBLE READABLE TEXT SHOULD BE THE TITLE: "A Wisp Lantern"`
    // const res2 = await textToImageOpenAi(prompt, 1, "/Users/shlomo.chotzen/Documents/GitHub/game/storyteller_be/assets/characterCreation/1.png")  
    // console.log(res2)

    // const cardStat = {'title':'Swordsmanship',
    //  'description':'Flurries of snow dance around as you wield your sword, its edge slicing through the frozen air. Each swing of your weapon leaves a shimmering arc in its wake, a testament to your deftness and precision.',
    //  'category':'Skill', 
    //  'subcategory':'Combat', 
    //  'illustration': 'In the frosty realm of the card, your silhouette dances in smooth, fluid movements obstructed by the icy blue white of the surroundings. The ethereal glow of your sword illuminates the sapphire tinge of the whirling snowflakes, mirroring the challenges you have yet to face in this RPG universe.', 
    //  'font':'Noto Sans'
    // }
    // const cardPrompt = characterCreationOptionPrompt(cardStat);
    const fragment = `it was almost night as they finally reached the house. it was much smaller than they expected. no more than a wooden shack in a forest's clearing. but that will have to do. the man said it was safe. and they had no other option than to trust him. they had about 15 minutes until there would be no light at all..and then they'll have to be inside. the house seemed empty but in good condition. at least from the outside. barred windows, barred door. Elira took out the key and approached the door`

    const userResponses = ['', '1.this is my first response', '2.this is my second response', '3.this is my third response', 
    '4.this is my 4th response', '5.this is my fifth response']


    const mockedStorytellerResponses = [`"Welcome, good to meet you," I say, leaning back in my high backed leather chair, a single desk lamp casting long, rolling shadows around my study. I'm William Orville Aston, but you may call me Aston. As the last of the clandestine cartographers, I draw paths out of words, skimming through realms unseen, and now you've chosen my services. Potential universes, untold narratives, hidden plots, concealed motives and elusive characters; they are not lost to me, but rather present a puzzle that inc…ack of daylight but carries some greater peril?"I let the question hang in the air, keen to observe your reaction. My eyes, flitting between you and the words on the page, are ready to pounce on the slightest hint you offer. A nod, a blink of hesitation, or a swift denial, everything contributes to the emerging universe, and I'm here to witness its birth. After all, your answers won't just validate my perception but also unravel the threads they're linked to, yet undiscovered by even yourself.`, '2. this is 2n storyteller.','3. this is 3rd storyteller.','4. this is 4th storyteller.'
    ,'5. this is 5th storyteller.','6. this is 6th storyteller.']


    const mockedTextureOptionsPrompts = [{prompt: 'texturePrompt1', font: 'font1'}, {prompt: 'texturePrompt2', font: 'font2'},{prompt: 'texturePrompt3', font: 'font3'},{prompt: 'texturePrompt4', font: 'font4'}]

    module.exports = {
        optionsMock,
        fragment,
        userResponses,
        mockedStorytellerResponses,
        mockedTextureOptionsPrompts
    };
    