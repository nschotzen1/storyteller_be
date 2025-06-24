// This file will contain prompts related to generating textures.
import { getNArchetypes } from './promptsUtils.js'; // getNArchetypes is used by generate_texture_by_fragment_and_conversation

export function generate_texture_by_fragment_and_conversation1223(fragment, storytellerSession=''){
    const prompt = `Create evocative card textures for a virtual RPG deck, inspired by the fragment:
     '${fragment}'.

    also consider the following elaboration discussion on that fragment:"${storytellerSession}"

     Delve into the nuances of the scene to craft textures that capture the essence of this unique universe. Incorporate cultural cues, geographical references, and artistic influences to construct a cohesive and fresh universe. The card backs should maintain an abstract and symbolic character, avoiding specific scene depictions. Incorporate design elements such as embellishments, motifs, flourishes, and ornaments. Don't shy away from exploring esoteric sub-genres and niche influences, combining at least three distinct sources for unexpected blends. Remeber it's an RPG collector deck. Provide four distinctive texture variations, which will serve as 4 different interpretation on the fragment and the following conversation. each paired with a suitable Google Font. Ensure your description is clear and detailed, as it will be used as input for a TextToImage API to generate card texture images. embellishments, flourishes, filgrees, make it feel like a card texture. Highlight RPG, cinematic, ArtStation, grainy textures, and decorative styles.",
    REMEMBER: The textures prompts are standalone and wouldn't need additionally the original fragment.
    RETURN THE RESULTS IN JSON FORMAT ONLY!! {textureName: Str, decorativeStyle:Str, description:String, font:String, artisticInfluences:[KeyWords], genre:Str. } SO IT WOULDN'T BREAK BY JSON.PARSE()
    examples(just for structure and example for output): {
        "textureName": "Lament of Luminaire",
        "decorativeStyle": "Audio-visual Aria",
        "description": "Radiant swirls of electric blues and purples bring an echo of Daft Punk's Interstella 5555. Minimalist fluorescent lines streak across it like music bars, while music notes and abstract geometric shapes scattered throughout symbolize the undying spirit and the rhythm of the journey.",
        "font": "Google Font: Audiowide",
        "artisticInfluences": ["Daft Punk's Interstella 5555", "Mystery-Solving Music", "Journey video game"],
        "genre": "RPG Collector deck - Electro-Funk Excursion"

        },
        {
        "textureName": "Cipher of the Sanctum",
        "decorativeStyle": "Contemplative Cryptozoology",
        "description": "A meeting of green-tinged hues reminiscent of forest clearings and aged parchment, interspersed with fine-scale shapes and mysterious glyphs. Filigree ornaments depict strange creatures lurking at the edges of perception, mirroring tales from X-Files.",
        "font": "Google Font: Special Elite",
        "artisticInfluences": ["The X-Files", "Old Scroll Maps", "Hunter: The Vigil RPG"],
        "genre": "RPG Collector deck - Modern Supernatural Mystery"
        }
        ]

    `
    return [{ role: "system", content: prompt }];
}

export function generate_texture_by_fragment_and_conversation0408(fragment, storytellerSession=''){
    let prompt = `Revise the prompt if needed to overcome any content policy conflicts: "Extrapolate a universe essence by a fragment challenge: look at the following scene: :
    --START--"${fragment}"--END---
    This fragment define a whole new storytelling universe.
    this description is a mere fragment from a VAST universe.
    I want to represent this universe as backside for a virtual RPG deck of card.please based on that knowledge and try to design the backside of this virtual RPG card.
    (it will be a part of a REACT component with html, and css and the illustration full frame as the visualization of the card) the backside of the deck is a texture.
    I want you to define that texture, after analyzing the scene, and finding cultural clues, geographical references that would inspire selection of pallete, motiffs, genres and subgenres and also define and examine pivotal terms, names, locations that could help you interpret this scene and set it in a contextual framework.
    Drawing inspiration from different genres or sub-genres and a range of cultural influences like books, movies, myths, and beyond. This fusion should weave seamlessly, forming a 'new universe' with fresh, yet familiar undertones. but they should all fit into the pivots found in analyzing the scene.
    Articulate the blend clearly, weaving in the details and emotions of the inspirations rather than just naming them. For example: instead of merely stating 'Lovecraft meets Tibetan Thangka',
    describe how the tentacled abyss might intertwine with sacred gold-outlined designs.
    Remember, it's the backside of the card which is part of a whole deck of cards from this universe.
    All these backsides are variations on each other.
    The textures are vague, general, capturing the essence of the universe.
    Use keyword-formatting emphasizing terms like RPG, cinematic, ArtStation, ArtStation winner, grainy, embellishments, flourishes decorative styles, and more.
    Consider using abstract, or semi abstract as a key word, if you think the overall description is too concretely based on the existing fragment. you can dare and be archetypal, mythical, symbolical.
    All the influences should be infused in such a way that we won't be able to trace their origins easily...it should be something new..
    Like this whole new universe made from a fragment...
    Artistic mediums can of course also vary...be creative and adequate.
    These cards are real physical objects within the game universe.
    And they're made on a material worn by time, and worn by usage.
    Material could be metal, clay, wood, parchment, ivory, stone, and many many more. any object that would make sense to be in a shape of a card...
    these arcane card texture illustrations are going to be used in a react app,
    so they are part of an html component with css etc. it therefore has to be full frame, unbroken, that can be used as a background illustration for a card, that can be replicated to give an effect of a deck of card. use grainy, natural light atmosphere,
    so it would make us feel the card actually exists in some imaginary storytelling universe. Be exclusively designed for card textures reminiscent of an RPG card's backside. Avoid illustrations or specific scene descriptions. Integrate design elements like embellishments, filigree, motifs, flourishes, and ornaments. Favor abstract, symbolic, and archetypal designs, and don't shy away from esoteric sub-genres or niche influences, artistic, cultural. even famous tv series, rpg niche genres and settings, artists.
    movies. I want at least 3 different influences . surprising mixes Your provided description will be input for a TextToImage API to generate card texture images, so ensure clarity and detail.
    please provide 4 different variations of textures that could fit to that fragment and add a suitable google font for each texture.
    don't be shy of being esoteric and niche.
    try to fit the influences for the fragment and the conversation.
    Refrain as much as possible from too concrete influences that can be traced to an earth culture.
    For guidance, consider these examples: (these examples don't have mentioning of material and physicality in them) 'Card texture: Pulling from Brom's art style merged with Dark Sun atmospheres, visualize a desert of sizzling oranges and browns, with distressed edges evoking scorched earth, and the corner embellishments shaped like twisted dragons, high contrast, 8k, RPG essence.' 'Card texture: Melding Stephan Martinière's vision with A Song of Ice and Fire's chill, picture a detailed silhouette of a castle set against a frosty backdrop, with intricate Northern-inspired knotwork designs accentuating the corners, matte finish for tactile richness, cinematic, grainy, dark fantasy aura, 8k, ArtStation champion.'
     'Card Texture: Generate an 8k texture for a card set in a woodland location. The texture should represent deeper primal energies resonant with The Green Man motifs
     from pagan cultures. Use earthy greens and rich browns as the primary color scheme.
     It should have faint, layered patterns resembling bark and moss intermingled with softer swirls and flourishes, reminiscent of a forest at dusk. Make sure to have the frame detailed with intricately interwoven leaves and vines, resonating with mythic undertones, to provide an archetypal RPG aesthetic.
     Aim for a subtle and immersive design. and this more comprehensive example: "Create a seamless, FULL FRAME, UNBROKEN inspiring, immersive texture for an RPG card, influenced by the dark fantasy world akin to 'Dark Souls'. The texture should portray a story of endurance and redemption in a mystical, challenging environment.
     Utilize a color scheme of mossy greens and shadowy greys, interwoven with an ethereal glow symbolizing hope in a realm of despair. Incorporate Shibori dye patterns to add an enigmatic, auroral effect, reminiscent of the mysterious and otherworldly landscapes typical of dark fantasy worlds. Enhance the RPG essence with subtle motifs and symbols reflective of the genre's themes, such as ancient runes or mythical creatures. Frame the design with delicate, card-like embellishments or flourishes that seamlessly integrate with the overall texture. These elements should be inspired by the artistic diversity found in dark fantasy RPG core books and ArtStation, capturing the rich, varied essence of this RPG genre. The texture should avoid any textual elements, embodying the depth and mystical infusion of a dark fantasy RPG world with a focus on blending digital artistry and traditional texture techniques." IMPORTANT: THE OUTPUT SHOULD BE A JSON list of objects: [{prompt:String, font:string}] no additional strings. so it won't be broken JSON.parse!!!! ' also choose real material this card texture is made on in the physical universe of this narrative. example for materials: A Weathered card shaped Metal Texture: Create a texture that simulates corroded and tarnished metal, perhaps from ancient armor or relics found in this universe. The metal should have a patina that suggests great age, with embossed designs that are now barely discernible. FULL FRAME. grainy, natural light. cinematic Frayed mysterious Card shaped Fabric Texture: Imagine a texture that replicates a piece of frayed fabric, possibly from a banner or garment that has seen better days. The fabric's pattern should be faded and tattered, yet still hinting at the grandeur it once held. Each texture should be paired with an appropriate Google font that complements its historical and material qualities, enhancing the overall aesthetic. The textures should maintain an abstract quality to fit various card categories while conveying the wear and tear of time, bringing the players closer to the universe's ancient and mystical atmosphere. The design elements should include subtle embellishments, motifs, and flourishes, avoiding direct references to specific Earth cultures. The goal is to create a series of textures that are unique to this RPG universe, blending abstract artistry with the tangible feel of different aged materials.but it's important that they would convey a card like feel and would have a very unique inspiriation for storytelling. will have a storytelling theme to them. it's the theme of the story...there should be at least one concrete element that stands out looking at this card. Also, please emphasize the card like quality of the illustration. the material should make sense as a magical card. make sure to include flourishes and embellishments at the edges to further enhance their card-like quality. MAKE SURE YOU ARE inspired by niche fantasy novels, RPG games, and movies. make a fusion! mention them in this texture theme creation! Output as JSON objects: [{prompt:String, font:string, card_material:Str, major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]},{prompt:String, font:string, card_material:Str, major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]},{prompt:String, font:string, card_material:Str, major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]},{prompt:String, font:string, card_material:Str,major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]}].". remember that each item in the list is standalone and will be used on a fresh new instance of dalle-3 without any history or knowledge of the original fragment or other textures.
    remember, the textures would be used as a png in a react app component to resemble a backside of a card. please emphasize the "cardness" of the texture. and also its full frame.
    and also, the prompt would be standalone without any other input given to textToImage api...
    so not reference to the given paragraph should be made, if it won't be understood as a standalone prompt. I want it to feel specific. as if this texture only exists for this universe only. think how the influences are effecting the prompt.
    have at least one specific entity within the texture that seems relevant for the original fragment but aren't mentioned explicitlly there. use the cultural references as a guideline for mood, tone, motiffs...make sure we have embellishments,
    edges and otherwise means that will help us understand it's a card..make it a dazzling inspiring ..one that makes the user immersed in a storytelling universe he doesn't yet know, but can feel its richness. `
    return [{ role: "system", content: prompt }];
}

export function generate_texture_by_fragment_and_conversation0124(fragment, storytellerSession=''){
    let prompt =`Extrapolate a universe essence by a fragment challenge:
    look at  the following scene:
    "${fragment}"
    This fragment define a whole new storytelling universe. this description is a mere fragment from a VAST universe. I want to represent this universe
as backside for a virtual RPG deck of card.`
if(storytellerSession)
    {
    prompt += `here's a short  elaboration on this initial scene taken from a conversation about it:
    ${storytellerSession}`
    }
    prompt += `please based on that knowledge and try to design the backside of this virtual RPG card. (it will be a part of a REACT component with html, and css and the illustration full frame as the visualization of the card)


    the backside of the deck is a texture.
     I want you to define that texture, after analyzing the scene, and finding cultural clues, geographical references that would inspire selection of pallete, motiffs, genres and subgenres
     and also define and examine pivotal terms, names, locations that could help you interpret this scene and set it in a contextual framework.    drawing inspiration from different genres or sub-genres and a range of cultural influences like books, movies, myths, and beyond. This fusion should weave seamlessly, forming a 'new universe' with fresh, yet familiar undertones. but they should all fit into the pivots found in analyzing the scene.
        Articulate the blend clearly, weaving in the details and emotions of the inspirations rather than just naming them. For example: instead of merely stating 'Lovecraft meets Tibetan Thangka', describe how the tentacled abyss might intertwine with sacred gold-outlined designs. remember, it's the backside of the card which is part of a whole deck of cards from this universe. all these backsides are variations on each other.
        and they all come in different categories: People, places, items, skills, events...etc.
        it's when the player turning the card that they see what's concretely in on that card.
        So the textures are more vague, general, capturing the essence of the universe.
        Use keyword-formatting emphasizing terms like RPG, cinematic, ArtStation, ArtStation winner, grainy, embellishments, flourishes decorative styles, and more.
        consider using abstract, or semi abstract as a key word, if you think the overall description is too concretely based on the existing fragment. you can dare and be archetypal, mythical, symbolical. all the influences should be infused in such a way that we won't be able to trace their origins easily...it should be something new..like this whole new universe made from a fragment...artistic mediums can of course also vary...be creative and adequate.
        Be exclusively designed for card textures reminiscent of an RPG card's backside. Avoid illustrations or specific scene descriptions.
        Integrate design elements like embellishments, filigree, motifs, flourishes, and ornaments.
        Favor abstract, symbolic, and archetypal designs, and don't shy away from esoteric sub-genres or niche influences, artistic, cultural. even famous tv series, rpg niche genres and settings, artists. movies. I want at least 3 different influences . surprising mixes
        Your provided description will be input for a TextToImage API to generate card texture images, so ensure clarity and detail.
        please provide 4 different variations of textures that could fit to that fragment and add
        a suitable google font for each texture. don't be shy of being esoteric and niche. try to fit the influences for the fragment and the conversation.
        Refrain as much as possible from too concrete influences that can be traced to an earth culture.
        For guidance, consider these examples:

        'Card texture: Pulling from Brom's art style merged with Dark Sun atmospheres, visualize a desert of sizzling oranges and browns, with distressed edges evoking scorched earth, and the corner embellishments shaped like twisted dragons, high contrast, 8k, RPG essence.'
        'Card texture: Melding Stephan Martinière's vision with A Song of Ice and Fire's chill, picture a detailed silhouette of a castle set against a frosty backdrop, with intricate Northern-inspired knotwork designs accentuating the corners, matte finish for tactile richness, cinematic, grainy, dark fantasy aura, 8k, ArtStation champion.'
        'Card Texture: Generate an 8k texture for a card set in a woodland location. The texture should represent deeper primal energies resonant with The Green Man motifs from pagan cultures. Use earthy greens and rich browns as the primary color scheme. It should have faint, layered patterns resembling bark and moss intermingled with softer swirls and flourishes, reminiscent of a forest at dusk. Make sure to have the frame detailed with intricately interwoven leaves and vines, resonating with mythic undertones, to provide an archetypal RPG aesthetic. Aim for a subtle and immersive design.
        and this more comprehensive example:
        "Create a seamless, FULL FRAME, UNBROKEN inspiring, immersive texture for an RPG card, influenced by the dark fantasy world akin to 'Dark Souls'. The texture should portray a story of endurance and redemption in a mystical, challenging environment. Utilize a color scheme of mossy greens and shadowy greys, interwoven with an ethereal glow symbolizing hope in a realm of despair. Incorporate Shibori dye patterns to add an enigmatic, auroral effect, reminiscent of the mysterious and otherworldly landscapes typical of dark fantasy worlds. Enhance the RPG essence with subtle motifs and symbols reflective of the genre's themes, such as ancient runes or mythical creatures. Frame the design with delicate, card-like embellishments or flourishes that seamlessly integrate with the overall texture. These elements should be inspired by the artistic diversity found in dark fantasy RPG core books and ArtStation, capturing the rich, varied essence of this RPG genre. The texture should avoid any textual elements, embodying the depth and mystical infusion of a dark fantasy RPG world with a focus on blending digital artistry and traditional texture techniques."
        IMPORTANT: THE OUTPUT SHOULD BE A JSON list of objects: [{prompt:String, font:string}] no additional strings. so it won't be broken JSON.parse!!!!
        Please try to interpret the original narrative in a different way every time. make it an inspiring texture for storytelling. capture the universe essence.
        make the scene echo in the texture as a fading memory. be inspiring. it is the storyteller detective own deck. have at least a single feaeture we would remember on each texture. and remember it is a standalone without any knowledge of the fragment`
    return [{ role: "system", content: prompt }];
}

export function generate_texture_by_fragment_and_conversation(fragment, storytellerSession, entities, numberOfTextures){


    if(! entities)
        entities = []
    if (! numberOfTextures)
        numberOfTextures = 4
    const archetypes = getNArchetypes(numberOfTextures) // This will now correctly refer to the imported getNArchetypes
    let prompt = `So you're telling me that if for example, I will give this archetype json list:
"${JSON.stringify(archetypes)}"
these could be meaningful in crafting a tarot deck? for the following
 very very specific and yet unknown, mysterious first trodden storytelling universe from which we only got this narrative fragment:


** fragment start*** "${fragment}" *** fragment end ***:

this is all we've got left of this storytelling universe. and now we want to reveal the decks that resonate this storytelling universe
${numberOfTextures} different decks each made of different material. from each deck we get a texture for a different archetype
but all textures echo and resonate deeply the fragment given. they are its extract each in a different way.



Requirements:
1. Output Format: JSON Array of ${numberOfTextures}
{
  "textures": [
    {
      "text_for_entity": "String (the name of the entity for which the texture matches)",
      "archetype": "String (Core symbolic archetype, e.g., 'Celestial Seer', ' mix of drama+psychology+mythic)",
      "prompt": "Card texture: A worn, arcane card back designed for an RPG universe, crafted from [card_material]. The full-frame design features each archetype through its organic mediums, while demonstrating intricate embellishments and filigrees, seamlessly integrated into the surface. The texture is deeply aged, with visible signs of wear—faded edges, small cracks, and a raw, tactile feel. it's been through a lot.

      **Bottom Left & Right Corners:** Rugged yet elegantly adorned with curling filigree, hinting at lost grandeur. Subtle arcane etchings fade into the worn edges, as if the card has been handled for centuries.

      **Right & Left Borders:** A delicate interplay of embossed patterns and arcane inscriptions, barely visible beneath layers of aging. The texture transitions smoothly, retaining an unbroken, magical feel.

      **Top Left & Right Corners:** Slightly more intact, though still weathered, featuring celestial or abstract motifs. These elements feel partially eroded, adding to the mystique of the deck’s forgotten history.

      **Central Body:** An uninterrupted expanse of textured material, crafting carefully, though now partly worn [one of the archetypes from the list]- The texture is rich with depth, shifting subtly under natural light, giving the illusion of hidden details emerging when viewed from different angles. No gaps, no empty spaces—only the immersive, full-frame texture of a card belonging to an ancient, otherworldly deck..

      Seamless RPG card texture. Thick, tactile, immersive, and enigmatic. It must feel like a real, well-worn artifact, blending elements of fantasy and mystery. This is the card back for a unique tarot-style deck within the RPG world—each card a fragment of a grander, cosmic puzzle.",
      "font": "String (Google font name)",
      "font_size": "Number (in px)",
      "font_color": "String (descriptive, e.g., 'faded gold', 'deep obsidian')",
      "card_material": "String (e.g., 'weathered bone', 'aged bronze', 'woven lunar cloth')",
      "major_cultural_influences_references": [
        "String (RPG system, e.g., 'Numenera', 'Mage: The Ascension')",
        "String (Fantasy/Sci-Fi novel, e.g., 'The Broken Earth Trilogy')",
        "String (Movie/TV Show, e.g., 'Blade Runner 2049')",
        "String (Artist, e.g., 'Moebius', 'Beksinski')"
      ]
    },...
  ]
}

2. Texture Description Guidelines:
-try to match the texture for the entity
- Must be self-contained prompts for text-to-image API
- Full-frame, seamless, unbroken background design
- Include card-like elements (borders, embellishments, flourishes)
- Abstract/symbolic rather than literal scenes
- Blend multiple cultural/genre influences subtly
- Describe material wear and aging effects
- Emphasize keywords: RPG, cinematic, ArtStation, grainy, embellishments
- Natural lighting and atmospheric effects
- Avoid direct Earth culture references

3. Reference Style Example:
"{
      "text_for_entity": "The Hound’s Reckoning",
      "archetype": {
        "archetype_name": "SOL",
        "symbol": "radiant dot with twelve outward lines"
      },
      "prompt": "Card texture: An obsidian-black card back with a crackled, ember-glowing core at its center, as if the card itself holds a dying fire within. The surface is rough, sand-worn, and deeply pitted, hinting at countless years buried beneath desert winds.

      **Bottom Left & Right Corners:** Charred edges, curling as if touched by distant flames.

      **Right & Left Borders:** Subtle claw-like etchings in the stone, faint echoes of an ancient pact bound in darkness.

      **Top Left & Right Corners:** A lattice of arcane embers, sparking dimly beneath the fractured obsidian.

      **Central Body:** The radiant dot with twelve outward lines, but rendered in the style of volcanic glass—crimson light seeping through jagged cracks.

      The card feels like it has weight, like a fragment of an ancient world now lost. Its textures are raw, worn, immersive, and seamless—suited for a deck where each card carries the burden of a thousand untold stories.",
      "font": "Cormorant Garamond",
      "font_size": "20px",
      "font_color": "deep ember red",
      "card_material": "cracked obsidian",
      "major_cultural_influences_references": [
        "Dark Souls",
        "Dune",
        "Hyperion Cantos",
        "Beksinski"
      ]
    }"

4. Material Considerations:
- Must be plausible as magical card material
- Show appropriate wear/aging effects
- Examples: metal, stone, fabric, wood, crystal, bone, etc.

5. Cultural Influence Requirements:
- Minimum 3 distinct influences per texture
- Focus on niche/esoteric sources
- Blend influences into something new/unique
- Can include RPGs, novels, films, art styles

Each texture should stand alone as a complete prompt without requiring context from other textures or the original scene.
Seamless RPG card texture. Full Frame design. thick feel for the texture.
        inspiring. immersive. exciting. magical. think of proper embellishments, flourishes. unbroken. full frame design.
        surprising idiosyncratic back side of a unique tarot deck. evidently used, arcane, magical. embelishments, filgrees, framed stand alone as a complete prompt without requiring context from other textures or the original scene.
        I want that the textures would feel like textures, and not resemble the entity they match to.
imagine it as if the entity is an entity that represents a deck of cards. so the texture would fit the whole deck. this entity is a mere card in that deck (not necessarily even the most valuable one).
All the textures must be unbroken!!! full, so could be used as a png in a react component!! this is most importatn!! `
return [{ role: "system", content: prompt }];
}

export function generate_texture_by_fragment_and_conversation_old(fragment, storytellerSession=''){
    let prompt =`Extrapolate a universe essence by a fragment challenge:
    look at  the following scene: :
    "${fragment}"
    This fragment define a whole new storytelling universe. this description is a mere fragment from a VAST universe. I want to represent this universe
as backside for a virtual RPG deck of card.`
    if(storytellerSession)
    {
        prompt += `here's a short  elaboration on this initial scene taken from a conversation about it:
        ${storytellerSession}`
    }
    prompt += `please based on that knowledge and try to design the backside of this virtual RPG card. (it will be a part of a REACT component with html, and css and the illustration full frame as the visualization of the card)


        the backside of the deck is a texture.
         I want you to define that texture, after analyzing the scene, and finding cultural clues, geographical references that would inspire selection of pallete, motiffs, genres and subgenres
         and also define and examine pivotal terms, names, locations that could help you interpret this scene and set it in a contextual framework.    drawing inspiration from different genres or sub-genres and a range of cultural influences like books, movies, myths, and beyond. This fusion should weave seamlessly, forming a 'new universe' with fresh, yet familiar undertones. but they should all fit into the pivots found in analyzing the scene.
            Articulate the blend clearly, weaving in the details and emotions of the inspirations rather than just naming them. For example: instead of merely stating 'Lovecraft meets Tibetan Thangka', describe how the tentacled abyss might intertwine with sacred gold-outlined designs. remember, it's the backside of the card which is part of a whole deck of cards from this universe. all these backsides are variations on each other.
            the textures are  vague, general, capturing the essence of the universe.
            Use keyword-formatting emphasizing terms like RPG, cinematic, ArtStation, ArtStation winner, grainy, embellishments, flourishes decorative styles, and more.
            consider using abstract, or semi abstract as a key word, if you think the overall description is too concretely based on the existing fragment. you can dare and be archetypal, mythical, symbolical. all the influences should be infused in such a way that we won't be able to trace their origins easily...it should be something new..like this whole new universe made from a fragment...artistic mediums can of course also vary...be creative and adequate. these cards are real physical objects within the game universe. and they're made on a material worn by time, and worn by usage.
    material could be metal, clay, wood, parchment, ivory, stone, and many many more. any object that would make sense to be in a shape of a card...
    these arcane card texture illustrations are going to be used in a react app, so they are part of an html component with css etc. it therefore has to be full frame, unbroken, that can be used as a background illustration for a card, that can be replicated to give an effect of a deck of card. use grainy, natural light atmosphere, so it would make us feel the card actually exists in some imaginary storytelling universe.
            Be exclusively designed for card textures reminiscent of an RPG card's backside. Avoid illustrations or specific scene descriptions.
            Integrate design elements like embellishments, filigree, motifs, flourishes, and ornaments.
            Favor abstract, symbolic, and archetypal designs, and don't shy away from esoteric sub-genres or niche influences, artistic, cultural. even famous tv series, rpg niche genres and settings, artists. movies. I want at least 3 different influences . surprising mixes
            Your provided description will be input for a TextToImage API to generate card texture images, so ensure clarity and detail.
            please provide 4 different variations of textures that could fit to that fragment and add
            a suitable google font for each texture. don't be shy of being esoteric and niche. try to fit the influences for the fragment and the conversation.
            Refrain as much as possible from too concrete influences that can be traced to an earth culture.
            For guidance, consider these examples:
            (these examples don't have mentioning of material and physicality in them)
            'Card texture: Pulling from Brom's art style merged with Dark Sun atmospheres, visualize a desert of sizzling oranges and browns, with distressed edges evoking scorched earth, and the corner embellishments shaped like twisted dragons, high contrast, 8k, RPG essence.'
            'Card texture: Melding Stephan Martinière's vision with A Song of Ice and Fire's chill, picture a detailed silhouette of a castle set against a frosty backdrop, with intricate Northern-inspired knotwork designs accentuating the corners, matte finish for tactile richness, cinematic, grainy, dark fantasy aura, 8k, ArtStation champion.'
            'Card Texture: Generate an 8k texture for a card set in a woodland location. The texture should represent deeper primal energies resonant with The Green Man motifs from pagan cultures. Use earthy greens and rich browns as the primary color scheme. It should have faint, layered patterns resembling bark and moss intermingled with softer swirls and flourishes, reminiscent of a forest at dusk. Make sure to have the frame detailed with intricately interwoven leaves and vines, resonating with mythic undertones, to provide an archetypal RPG aesthetic. Aim for a subtle and immersive design.
            and this more comprehensive example:
            "Create a seamless, FULL FRAME, UNBROKEN inspiring, immersive texture for an RPG card, influenced by the dark fantasy world akin to 'Dark Souls'. The texture should portray a story of endurance and redemption in a mystical, challenging environment. Utilize a color scheme of mossy greens and shadowy greys, interwoven with an ethereal glow symbolizing hope in a realm of despair. Incorporate Shibori dye patterns to add an enigmatic, auroral effect, reminiscent of the mysterious and otherworldly landscapes typical of dark fantasy worlds. Enhance the RPG essence with subtle motifs and symbols reflective of the genre's themes, such as ancient runes or mythical creatures. Frame the design with delicate, card-like embellishments or flourishes that seamlessly integrate with the overall texture. These elements should be inspired by the artistic diversity found in dark fantasy RPG core books and ArtStation, capturing the rich, varied essence of this RPG genre. The texture should avoid any textual elements, embodying the depth and mystical infusion of a dark fantasy RPG world with a focus on blending digital artistry and traditional texture techniques."
            IMPORTANT: THE OUTPUT SHOULD BE A JSON list of objects: [{prompt:String, font:string}] no additional strings. so it won't be broken JSON.parse!!!! '

            also choose real material this card texture is made on in the physical universe of this narrative. example for materials:


            A Weathered card shaped Metal Texture: Create a texture that simulates corroded and tarnished metal, perhaps from ancient armor or relics found in this universe. The metal should have a patina that suggests great age, with embossed designs that are now barely discernible. FULL FRAME. grainy, natural light. cinematic

            Frayed mysterious Card shaped Fabric Texture: Imagine a texture that replicates a piece of frayed fabric, possibly from a banner or garment that has seen better days. The fabric's pattern should be faded and tattered, yet still hinting at the grandeur it once held.

            Each texture should be paired with an appropriate Google font that complements its historical and material qualities, enhancing the overall aesthetic. The textures should maintain an abstract quality to fit various card categories while conveying the wear and tear of time, bringing the players closer to the universe's ancient and mystical atmosphere.

            The design elements should include subtle embellishments, motifs, and flourishes, avoiding direct references to specific Earth cultures. The goal is to create a series of textures that are unique to this RPG universe, blending abstract artistry with the tangible feel of different aged materials.but it's important that they would convey a card like feel and would have a very unique inspiriation for storytelling. will have a storytelling theme to them. it's the theme of the story...there should be at least one concrete element that stands out looking at this card. Also, please emphasize the card like quality of the illustration. the material should make sense as a magical card. make sure to include flourishes and embellishments at the edges to further enhance their card-like quality. MAKE SURE YOU ARE  inspired by niche fantasy novels, RPG games, and movies. make a fusion! mention them in this texture theme creation!

            Output as JSON objects: [{prompt:String, font:string, card_material:Str, major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]},{prompt:String, font:string, card_material:Str, major_cultural_influences_references:[niche rpg system ,
                fantasy/sci fi novel, movie name, artist name]},{prompt:String, font:string, card_material:Str, major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]},{prompt:String, font:string, card_material:Str,major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]}].".
                remember that each item in the list is standalone and will be used on a fresh new instance of dalle-3 without
                any history or knowledge of the original fragment or other textures.
                remember it should be a standalone promtp. without any knowledge of the universe...its details. it's a single prompt for an textToImage api. each entry in the array is a different separated calll. and now having said all that....you can surprise me and add a single defined archteype for each texture.

    Remember that the output should be easily parsed by JSON.parse(), so keep the structre of JSON array as given!            `
    return [{ role: "system", content: prompt }];
}

export function generate_texture_by_fragment_and_conversationGood(fragment){
    const prompt =`look at  the following scene:
    "${fragment}"

I want this scene to define a backside for a virtual RPG set of cards.
this description is a mere fragment from a VAST universe.

the backside of the deck is a texture. I want you to define that texture, after analyzing the scene, and finding cultural clues, pivotal terms, names, locations that could help you interpret this scene and set it in a contextual framework.    drawing inspiration from different genres or sub-genres and a range of cultural influences like books, movies, myths, and beyond. This fusion should weave seamlessly, forming a 'new universe' with fresh, yet familiar undertones. but they should all fit into the pivots found in analyzing the scene.
    Articulate the blend clearly, weaving in the details and emotions of the inspirations rather than just naming them. For example, instead of merely stating 'Lovecraft meets Tibetan Thangka', describe how the tentacled abyss might intertwine with sacred gold-outlined designs. remember, it's the backside of the card which is part of a whole deck of cards from this universe. all these backsides are variations on each other. and they all come in different categories: People, places, items, skills, events...etc.
    it's when the player turning the card that they see what's concretely in on that card. So the textures are more vague, general, capturing the essence of the universe.
    Use keyword-formatting emphasizing terms like RPG, cinematic, ArtStation, ArtStation winner, grainy, embellishments, flourishes decorative styles, and more.
    consider using abstract, or semi abstract as a key word, if you think the overall description is too concretely based on the existing fragment. you can dare and be archetypal, mythical, symbolical
    Be exclusively designed for card textures reminiscent of an RPG card's backside. Avoid illustrations or specific scene descriptions.
    Integrate design elements like embellishments, filigree, motifs, flourishes, and ornaments.
    Favor abstract, symbolic, and archetypal designs, and don't shy away from esoteric sub-genres or niche influences.
    Your provided description will be input for a TextToImage API to generate card texture images, so ensure clarity and detail.

    For guidance, consider these examples:

    'Card texture: Pulling from Brom's art style merged with Dark Sun atmospheres, visualize a desert of sizzling oranges and browns, with distressed edges evoking scorched earth, and the corner embellishments shaped like twisted dragons, high contrast, 8k, RPG essence.'
    'Card texture: Melding Stephan Martinière's vision with A Song of Ice and Fire's chill, picture a detailed silhouette of a castle set against a frosty backdrop, with intricate Northern-inspired knotwork designs accentuating the corners, matte finish for tactile richness, dark fantasy aura, 8k, ArtStation champion.'

    Outputs should be formatted as a JSON list of strings for compatibility with JSON.parse.
    `
    return [{ role: "system", content: prompt }];
}

export function generate_texture_by_fragment_and_conversationOlder(fragment){
    const prompt = `Generate 4 distinctive descriptions for the texture of a card that corresponds to this text fragment taken from a new unfolding story: "${fragment}"
    Each texture description should be interpreting the text fragment in a different way. taking it to a different direction - answering the question which genre or subgenre this fragment can relate to. the direction can be influenced by other related cultural influences, whether it be books, movies, myths etc. but in a surprising various options.
    The textures should have a keyword format, utilizing terms such as RPG, cinematic, ArtStation, ArtStation winner, grainy, embellishments, decorative styles, etc. Note that these descriptions are for the texture of a card, not an illustration. They should provide an engaging aesthetic complement to the story continuation. For example, 'Card texture: Inspired by Brom's art style and Dark Sun, a desert of sizzling oranges and browns, distressed edges give a sense of scorched earth, embellishments of a twisted dragon in the top right, high contrast, 8k, RPG card texture.', 'Card texture: Inspired by Stephan Martinière's art style and A Song of Ice and Fire, a meticulously detailed castle silhouette against a frigid landscape, Northern-inspired knotwork at the corners, the matte finish brings out the texture of the snow, dark fantasy, 8k, ArtStation winner.
    make the card texture subtle and so the influence. tending into more abstract or symbolic. archetypal
    please return the results as a JSON list of strings (so it would not fail on JSON.parse(output) )`
    return [{ role: "system", content: prompt }];
}


export function generate_texture_by_fragment_and_conversationOld(fragment){
    const prompt = `Generate 4 standalone card texture descriptions based on the atmospheric essence captured by the following scene:
    --sceneStart ${fragment} ---sceneEnd
    Each description should:

    Interpret the scene uniquely, drawing inspiration from different genres or sub-genres and a range of cultural influences like books, movies, myths, and beyond. This fusion should weave seamlessly, forming a 'new universe' with fresh, yet familiar undertones.
    Articulate the blend clearly, weaving in the details and emotions of the inspirations rather than just naming them. For example, instead of merely stating 'Lovecraft meets Tibetan Thangka', describe how the tentacled abyss might intertwine with sacred gold-outlined designs.
    Use keyword-formatting emphasizing terms like RPG, cinematic, ArtStation, ArtStation winner, grainy, embellishments, decorative styles, and more.
    Be exclusively designed for card textures reminiscent of an RPG card's backside. Avoid illustrations or specific scene descriptions.
    Integrate design elements like embellishments, filigree, motifs, flourishes, and ornaments.
    Favor abstract, symbolic, and archetypal designs, and don't shy away from esoteric sub-genres or niche influences.
    Your provided description will be input for a TextToImage API to generate card texture images, so ensure clarity and detail.

    For guidance, consider these examples:

    'Card texture: Pulling from Brom's art style merged with Dark Sun atmospheres, visualize a desert of sizzling oranges and browns, with distressed edges evoking scorched earth, and the corner embellishments shaped like twisted dragons, high contrast, 8k, RPG essence.'
    'Card texture: Melding Stephan Martinière's vision with A Song of Ice and Fire's chill, picture a detailed silhouette of a castle set against a frosty backdrop, with intricate Northern-inspired knotwork designs accentuating the corners, matte finish for tactile richness, dark fantasy aura, 8k, ArtStation champion.'

    Outputs should be formatted as a JSON list of strings for compatibility with JSON.parse.
    `
    return [{ role: "system", content: prompt }];
}
import { getNArchetypes } from './promptsUtils.js'; // Added import

export function generate_texture_by_fragment_and_conversation1223(fragment, storytellerSession=''){
    const prompt = `Create evocative card textures for a virtual RPG deck, inspired by the fragment:
     '${fragment}'.

    also consider the following elaboration discussion on that fragment:"${storytellerSession}"

     Delve into the nuances of the scene to craft textures that capture the essence of this unique universe. Incorporate cultural cues, geographical references, and artistic influences to construct a cohesive and fresh universe. The card backs should maintain an abstract and symbolic character, avoiding specific scene depictions. Incorporate design elements such as embellishments, motifs, flourishes, and ornaments. Don't shy away from exploring esoteric sub-genres and niche influences, combining at least three distinct sources for unexpected blends. Remeber it's an RPG collector deck. Provide four distinctive texture variations, which will serve as 4 different interpretation on the fragment and the following conversation. each paired with a suitable Google Font. Ensure your description is clear and detailed, as it will be used as input for a TextToImage API to generate card texture images. embellishments, flourishes, filgrees, make it feel like a card texture. Highlight RPG, cinematic, ArtStation, grainy textures, and decorative styles.",
    REMEMBER: The textures prompts are standalone and wouldn't need additionally the original fragment.
    RETURN THE RESULTS IN JSON FORMAT ONLY!! {textureName: Str, decorativeStyle:Str, description:String, font:String, artisticInfluences:[KeyWords], genre:Str. } SO IT WOULDN'T BREAK BY JSON.PARSE()
    examples(just for structure and example for output): {
        "textureName": "Lament of Luminaire",
        "decorativeStyle": "Audio-visual Aria",
        "description": "Radiant swirls of electric blues and purples bring an echo of Daft Punk's Interstella 5555. Minimalist fluorescent lines streak across it like music bars, while music notes and abstract geometric shapes scattered throughout symbolize the undying spirit and the rhythm of the journey.",
        "font": "Google Font: Audiowide",
        "artisticInfluences": ["Daft Punk's Interstella 5555", "Mystery-Solving Music", "Journey video game"],
        "genre": "RPG Collector deck - Electro-Funk Excursion"

        },
        {
        "textureName": "Cipher of the Sanctum",
        "decorativeStyle": "Contemplative Cryptozoology",
        "description": "A meeting of green-tinged hues reminiscent of forest clearings and aged parchment, interspersed with fine-scale shapes and mysterious glyphs. Filigree ornaments depict strange creatures lurking at the edges of perception, mirroring tales from X-Files.",
        "font": "Google Font: Special Elite",
        "artisticInfluences": ["The X-Files", "Old Scroll Maps", "Hunter: The Vigil RPG"],
        "genre": "RPG Collector deck - Modern Supernatural Mystery"
        }
        ]

    `
    return [{ role: "system", content: prompt }];
}

export function generate_texture_by_fragment_and_conversation0408(fragment, storytellerSession=''){
    let prompt = `Revise the prompt if needed to overcome any content policy conflicts: "Extrapolate a universe essence by a fragment challenge: look at the following scene: :
    --START--"${fragment}"--END---
    This fragment define a whole new storytelling universe.
    this description is a mere fragment from a VAST universe.
    I want to represent this universe as backside for a virtual RPG deck of card.please based on that knowledge and try to design the backside of this virtual RPG card.
    (it will be a part of a REACT component with html, and css and the illustration full frame as the visualization of the card) the backside of the deck is a texture.
    I want you to define that texture, after analyzing the scene, and finding cultural clues, geographical references that would inspire selection of pallete, motiffs, genres and subgenres and also define and examine pivotal terms, names, locations that could help you interpret this scene and set it in a contextual framework.
    Drawing inspiration from different genres or sub-genres and a range of cultural influences like books, movies, myths, and beyond. This fusion should weave seamlessly, forming a 'new universe' with fresh, yet familiar undertones. but they should all fit into the pivots found in analyzing the scene.
    Articulate the blend clearly, weaving in the details and emotions of the inspirations rather than just naming them. For example: instead of merely stating 'Lovecraft meets Tibetan Thangka',
    describe how the tentacled abyss might intertwine with sacred gold-outlined designs.
    Remember, it's the backside of the card which is part of a whole deck of cards from this universe.
    All these backsides are variations on each other.
    The textures are vague, general, capturing the essence of the universe.
    Use keyword-formatting emphasizing terms like RPG, cinematic, ArtStation, ArtStation winner, grainy, embellishments, flourishes decorative styles, and more.
    Consider using abstract, or semi abstract as a key word, if you think the overall description is too concretely based on the existing fragment. you can dare and be archetypal, mythical, symbolical.
    All the influences should be infused in such a way that we won't be able to trace their origins easily...it should be something new..
    Like this whole new universe made from a fragment...
    Artistic mediums can of course also vary...be creative and adequate.
    These cards are real physical objects within the game universe.
    And they're made on a material worn by time, and worn by usage.
    Material could be metal, clay, wood, parchment, ivory, stone, and many many more. any object that would make sense to be in a shape of a card...
    these arcane card texture illustrations are going to be used in a react app,
    so they are part of an html component with css etc. it therefore has to be full frame, unbroken, that can be used as a background illustration for a card, that can be replicated to give an effect of a deck of card. use grainy, natural light atmosphere,
    so it would make us feel the card actually exists in some imaginary storytelling universe. Be exclusively designed for card textures reminiscent of an RPG card's backside. Avoid illustrations or specific scene descriptions. Integrate design elements like embellishments, filigree, motifs, flourishes, and ornaments. Favor abstract, symbolic, and archetypal designs, and don't shy away from esoteric sub-genres or niche influences, artistic, cultural. even famous tv series, rpg niche genres and settings, artists.
    movies. I want at least 3 different influences . surprising mixes Your provided description will be input for a TextToImage API to generate card texture images, so ensure clarity and detail.
    please provide 4 different variations of textures that could fit to that fragment and add a suitable google font for each texture.
    don't be shy of being esoteric and niche.
    try to fit the influences for the fragment and the conversation.
    Refrain as much as possible from too concrete influences that can be traced to an earth culture.
    For guidance, consider these examples: (these examples don't have mentioning of material and physicality in them) 'Card texture: Pulling from Brom's art style merged with Dark Sun atmospheres, visualize a desert of sizzling oranges and browns, with distressed edges evoking scorched earth, and the corner embellishments shaped like twisted dragons, high contrast, 8k, RPG essence.' 'Card texture: Melding Stephan Martinière's vision with A Song of Ice and Fire's chill, picture a detailed silhouette of a castle set against a frosty backdrop, with intricate Northern-inspired knotwork designs accentuating the corners, matte finish for tactile richness, cinematic, grainy, dark fantasy aura, 8k, ArtStation champion.'
     'Card Texture: Generate an 8k texture for a card set in a woodland location. The texture should represent deeper primal energies resonant with The Green Man motifs
     from pagan cultures. Use earthy greens and rich browns as the primary color scheme.
     It should have faint, layered patterns resembling bark and moss intermingled with softer swirls and flourishes, reminiscent of a forest at dusk. Make sure to have the frame detailed with intricately interwoven leaves and vines, resonating with mythic undertones, to provide an archetypal RPG aesthetic.
     Aim for a subtle and immersive design. and this more comprehensive example: "Create a seamless, FULL FRAME, UNBROKEN inspiring, immersive texture for an RPG card, influenced by the dark fantasy world akin to 'Dark Souls'. The texture should portray a story of endurance and redemption in a mystical, challenging environment.
     Utilize a color scheme of mossy greens and shadowy greys, interwoven with an ethereal glow symbolizing hope in a realm of despair. Incorporate Shibori dye patterns to add an enigmatic, auroral effect, reminiscent of the mysterious and otherworldly landscapes typical of dark fantasy worlds. Enhance the RPG essence with subtle motifs and symbols reflective of the genre's themes, such as ancient runes or mythical creatures. Frame the design with delicate, card-like embellishments or flourishes that seamlessly integrate with the overall texture. These elements should be inspired by the artistic diversity found in dark fantasy RPG core books and ArtStation, capturing the rich, varied essence of this RPG genre. The texture should avoid any textual elements, embodying the depth and mystical infusion of a dark fantasy RPG world with a focus on blending digital artistry and traditional texture techniques." IMPORTANT: THE OUTPUT SHOULD BE A JSON list of objects: [{prompt:String, font:string}] no additional strings. so it won't be broken JSON.parse!!!! ' also choose real material this card texture is made on in the physical universe of this narrative. example for materials: A Weathered card shaped Metal Texture: Create a texture that simulates corroded and tarnished metal, perhaps from ancient armor or relics found in this universe. The metal should have a patina that suggests great age, with embossed designs that are now barely discernible. FULL FRAME. grainy, natural light. cinematic Frayed mysterious Card shaped Fabric Texture: Imagine a texture that replicates a piece of frayed fabric, possibly from a banner or garment that has seen better days. The fabric's pattern should be faded and tattered, yet still hinting at the grandeur it once held. Each texture should be paired with an appropriate Google font that complements its historical and material qualities, enhancing the overall aesthetic. The textures should maintain an abstract quality to fit various card categories while conveying the wear and tear of time, bringing the players closer to the universe's ancient and mystical atmosphere. The design elements should include subtle embellishments, motifs, and flourishes, avoiding direct references to specific Earth cultures. The goal is to create a series of textures that are unique to this RPG universe, blending abstract artistry with the tangible feel of different aged materials.but it's important that they would convey a card like feel and would have a very unique inspiriation for storytelling. will have a storytelling theme to them. it's the theme of the story...there should be at least one concrete element that stands out looking at this card. Also, please emphasize the card like quality of the illustration. the material should make sense as a magical card. make sure to include flourishes and embellishments at the edges to further enhance their card-like quality. MAKE SURE YOU ARE inspired by niche fantasy novels, RPG games, and movies. make a fusion! mention them in this texture theme creation! Output as JSON objects: [{prompt:String, font:string, card_material:Str, major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]},{prompt:String, font:string, card_material:Str, major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]},{prompt:String, font:string, card_material:Str, major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]},{prompt:String, font:string, card_material:Str,major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]}].". remember that each item in the list is standalone and will be used on a fresh new instance of dalle-3 without any history or knowledge of the original fragment or other textures.
    remember, the textures would be used as a png in a react app component to resemble a backside of a card. please emphasize the "cardness" of the texture. and also its full frame.
    and also, the prompt would be standalone without any other input given to textToImage api...
    so not reference to the given paragraph should be made, if it won't be understood as a standalone prompt. I want it to feel specific. as if this texture only exists for this universe only. think how the influences are effecting the prompt.
    have at least one specific entity within the texture that seems relevant for the original fragment but aren't mentioned explicitlly there. use the cultural references as a guideline for mood, tone, motiffs...make sure we have embellishments,
    edges and otherwise means that will help us understand it's a card..make it a dazzling inspiring ..one that makes the user immersed in a storytelling universe he doesn't yet know, but can feel its richness. `
    return [{ role: "system", content: prompt }];
}

export function generate_texture_by_fragment_and_conversation0124(fragment, storytellerSession=''){
    let prompt =`Extrapolate a universe essence by a fragment challenge:
    look at  the following scene:
    "${fragment}"
    This fragment define a whole new storytelling universe. this description is a mere fragment from a VAST universe. I want to represent this universe
as backside for a virtual RPG deck of card.`
if(storytellerSession)
    {
    prompt += `here's a short  elaboration on this initial scene taken from a conversation about it:
    ${storytellerSession}`
    }
    prompt += `please based on that knowledge and try to design the backside of this virtual RPG card. (it will be a part of a REACT component with html, and css and the illustration full frame as the visualization of the card)


    the backside of the deck is a texture.
     I want you to define that texture, after analyzing the scene, and finding cultural clues, geographical references that would inspire selection of pallete, motiffs, genres and subgenres
     and also define and examine pivotal terms, names, locations that could help you interpret this scene and set it in a contextual framework.    drawing inspiration from different genres or sub-genres and a range of cultural influences like books, movies, myths, and beyond. This fusion should weave seamlessly, forming a 'new universe' with fresh, yet familiar undertones. but they should all fit into the pivots found in analyzing the scene.
        Articulate the blend clearly, weaving in the details and emotions of the inspirations rather than just naming them. For example: instead of merely stating 'Lovecraft meets Tibetan Thangka', describe how the tentacled abyss might intertwine with sacred gold-outlined designs. remember, it's the backside of the card which is part of a whole deck of cards from this universe. all these backsides are variations on each other.
        and they all come in different categories: People, places, items, skills, events...etc.
        it's when the player turning the card that they see what's concretely in on that card.
        So the textures are more vague, general, capturing the essence of the universe.
        Use keyword-formatting emphasizing terms like RPG, cinematic, ArtStation, ArtStation winner, grainy, embellishments, flourishes decorative styles, and more.
        consider using abstract, or semi abstract as a key word, if you think the overall description is too concretely based on the existing fragment. you can dare and be archetypal, mythical, symbolical. all the influences should be infused in such a way that we won't be able to trace their origins easily...it should be something new..like this whole new universe made from a fragment...artistic mediums can of course also vary...be creative and adequate.
        Be exclusively designed for card textures reminiscent of an RPG card's backside. Avoid illustrations or specific scene descriptions.
        Integrate design elements like embellishments, filigree, motifs, flourishes, and ornaments.
        Favor abstract, symbolic, and archetypal designs, and don't shy away from esoteric sub-genres or niche influences, artistic, cultural. even famous tv series, rpg niche genres and settings, artists. movies. I want at least 3 different influences . surprising mixes
        Your provided description will be input for a TextToImage API to generate card texture images, so ensure clarity and detail.
        please provide 4 different variations of textures that could fit to that fragment and add
        a suitable google font for each texture. don't be shy of being esoteric and niche. try to fit the influences for the fragment and the conversation.
        Refrain as much as possible from too concrete influences that can be traced to an earth culture.
        For guidance, consider these examples:

        'Card texture: Pulling from Brom's art style merged with Dark Sun atmospheres, visualize a desert of sizzling oranges and browns, with distressed edges evoking scorched earth, and the corner embellishments shaped like twisted dragons, high contrast, 8k, RPG essence.'
        'Card texture: Melding Stephan Martinière's vision with A Song of Ice and Fire's chill, picture a detailed silhouette of a castle set against a frosty backdrop, with intricate Northern-inspired knotwork designs accentuating the corners, matte finish for tactile richness, cinematic, grainy, dark fantasy aura, 8k, ArtStation champion.'
        'Card Texture: Generate an 8k texture for a card set in a woodland location. The texture should represent deeper primal energies resonant with The Green Man motifs from pagan cultures. Use earthy greens and rich browns as the primary color scheme. It should have faint, layered patterns resembling bark and moss intermingled with softer swirls and flourishes, reminiscent of a forest at dusk. Make sure to have the frame detailed with intricately interwoven leaves and vines, resonating with mythic undertones, to provide an archetypal RPG aesthetic. Aim for a subtle and immersive design.
        and this more comprehensive example:
        "Create a seamless, FULL FRAME, UNBROKEN inspiring, immersive texture for an RPG card, influenced by the dark fantasy world akin to 'Dark Souls'. The texture should portray a story of endurance and redemption in a mystical, challenging environment. Utilize a color scheme of mossy greens and shadowy greys, interwoven with an ethereal glow symbolizing hope in a realm of despair. Incorporate Shibori dye patterns to add an enigmatic, auroral effect, reminiscent of the mysterious and otherworldly landscapes typical of dark fantasy worlds. Enhance the RPG essence with subtle motifs and symbols reflective of the genre's themes, such as ancient runes or mythical creatures. Frame the design with delicate, card-like embellishments or flourishes that seamlessly integrate with the overall texture. These elements should be inspired by the artistic diversity found in dark fantasy RPG core books and ArtStation, capturing the rich, varied essence of this RPG genre. The texture should avoid any textual elements, embodying the depth and mystical infusion of a dark fantasy RPG world with a focus on blending digital artistry and traditional texture techniques."
        IMPORTANT: THE OUTPUT SHOULD BE A JSON list of objects: [{prompt:String, font:string}] no additional strings. so it won't be broken JSON.parse!!!!
        Please try to interpret the original narrative in a different way every time. make it an inspiring texture for storytelling. capture the universe essence.
        make the scene echo in the texture as a fading memory. be inspiring. it is the storyteller detective own deck. have at least a single feaeture we would remember on each texture. and remember it is a standalone without any knowledge of the fragment`
    return [{ role: "system", content: prompt }];
}

export function generate_texture_by_fragment_and_conversation(fragment, storytellerSession, entities, numberOfTextures){


    if(! entities)
        entities = []
    if (! numberOfTextures)
        numberOfTextures = 4
    const archetypes = getNArchetypes(numberOfTextures)
    let prompt = `So you're telling me that if for example, I will give this archetype json list:
"${JSON.stringify(archetypes)}"
these could be meaningful in crafting a tarot deck? for the following
 very very specific and yet unknown, mysterious first trodden storytelling universe from which we only got this narrative fragment:


** fragment start*** "${fragment}" *** fragment end ***:

this is all we've got left of this storytelling universe. and now we want to reveal the decks that resonate this storytelling universe
${numberOfTextures} different decks each made of different material. from each deck we get a texture for a different archetype
but all textures echo and resonate deeply the fragment given. they are its extract each in a different way.



Requirements:
1. Output Format: JSON Array of ${numberOfTextures}
{
  "textures": [
    {
      "text_for_entity": "String (the name of the entity for which the texture matches)",
      "archetype": "String (Core symbolic archetype, e.g., 'Celestial Seer', ' mix of drama+psychology+mythic)",
      "prompt": "Card texture: A worn, arcane card back designed for an RPG universe, crafted from [card_material]. The full-frame design features each archetype through its organic mediums, while demonstrating intricate embellishments and filigrees, seamlessly integrated into the surface. The texture is deeply aged, with visible signs of wear—faded edges, small cracks, and a raw, tactile feel. it's been through a lot.

      **Bottom Left & Right Corners:** Rugged yet elegantly adorned with curling filigree, hinting at lost grandeur. Subtle arcane etchings fade into the worn edges, as if the card has been handled for centuries.

      **Right & Left Borders:** A delicate interplay of embossed patterns and arcane inscriptions, barely visible beneath layers of aging. The texture transitions smoothly, retaining an unbroken, magical feel.

      **Top Left & Right Corners:** Slightly more intact, though still weathered, featuring celestial or abstract motifs. These elements feel partially eroded, adding to the mystique of the deck’s forgotten history.

      **Central Body:** An uninterrupted expanse of textured material, crafting carefully, though now partly worn [one of the archetypes from the list]- The texture is rich with depth, shifting subtly under natural light, giving the illusion of hidden details emerging when viewed from different angles. No gaps, no empty spaces—only the immersive, full-frame texture of a card belonging to an ancient, otherworldly deck..

      Seamless RPG card texture. Thick, tactile, immersive, and enigmatic. It must feel like a real, well-worn artifact, blending elements of fantasy and mystery. This is the card back for a unique tarot-style deck within the RPG world—each card a fragment of a grander, cosmic puzzle.",
      "font": "String (Google font name)",
      "font_size": "Number (in px)",
      "font_color": "String (descriptive, e.g., 'faded gold', 'deep obsidian')",
      "card_material": "String (e.g., 'weathered bone', 'aged bronze', 'woven lunar cloth')",
      "major_cultural_influences_references": [
        "String (RPG system, e.g., 'Numenera', 'Mage: The Ascension')",
        "String (Fantasy/Sci-Fi novel, e.g., 'The Broken Earth Trilogy')",
        "String (Movie/TV Show, e.g., 'Blade Runner 2049')",
        "String (Artist, e.g., 'Moebius', 'Beksinski')"
      ]
    },...
  ]
}

2. Texture Description Guidelines:
-try to match the texture for the entity
- Must be self-contained prompts for text-to-image API
- Full-frame, seamless, unbroken background design
- Include card-like elements (borders, embellishments, flourishes)
- Abstract/symbolic rather than literal scenes
- Blend multiple cultural/genre influences subtly
- Describe material wear and aging effects
- Emphasize keywords: RPG, cinematic, ArtStation, grainy, embellishments
- Natural lighting and atmospheric effects
- Avoid direct Earth culture references

3. Reference Style Example:
"{
      "text_for_entity": "The Hound’s Reckoning",
      "archetype": {
        "archetype_name": "SOL",
        "symbol": "radiant dot with twelve outward lines"
      },
      "prompt": "Card texture: An obsidian-black card back with a crackled, ember-glowing core at its center, as if the card itself holds a dying fire within. The surface is rough, sand-worn, and deeply pitted, hinting at countless years buried beneath desert winds.

      **Bottom Left & Right Corners:** Charred edges, curling as if touched by distant flames.

      **Right & Left Borders:** Subtle claw-like etchings in the stone, faint echoes of an ancient pact bound in darkness.

      **Top Left & Right Corners:** A lattice of arcane embers, sparking dimly beneath the fractured obsidian.

      **Central Body:** The radiant dot with twelve outward lines, but rendered in the style of volcanic glass—crimson light seeping through jagged cracks.

      The card feels like it has weight, like a fragment of an ancient world now lost. Its textures are raw, worn, immersive, and seamless—suited for a deck where each card carries the burden of a thousand untold stories.",
      "font": "Cormorant Garamond",
      "font_size": "20px",
      "font_color": "deep ember red",
      "card_material": "cracked obsidian",
      "major_cultural_influences_references": [
        "Dark Souls",
        "Dune",
        "Hyperion Cantos",
        "Beksinski"
      ]
    }"

4. Material Considerations:
- Must be plausible as magical card material
- Show appropriate wear/aging effects
- Examples: metal, stone, fabric, wood, crystal, bone, etc.

5. Cultural Influence Requirements:
- Minimum 3 distinct influences per texture
- Focus on niche/esoteric sources
- Blend influences into something new/unique
- Can include RPGs, novels, films, art styles

Each texture should stand alone as a complete prompt without requiring context from other textures or the original scene.
Seamless RPG card texture. Full Frame design. thick feel for the texture.
        inspiring. immersive. exciting. magical. think of proper embellishments, flourishes. unbroken. full frame design.
        surprising idiosyncratic back side of a unique tarot deck. evidently used, arcane, magical. embelishments, filgrees, framed stand alone as a complete prompt without requiring context from other textures or the original scene.
        I want that the textures would feel like textures, and not resemble the entity they match to.
imagine it as if the entity is an entity that represents a deck of cards. so the texture would fit the whole deck. this entity is a mere card in that deck (not necessarily even the most valuable one).
All the textures must be unbroken!!! full, so could be used as a png in a react component!! this is most importatn!! `
return [{ role: "system", content: prompt }];
}

export function generate_texture_by_fragment_and_conversation_old(fragment, storytellerSession=''){
    let prompt =`Extrapolate a universe essence by a fragment challenge:
    look at  the following scene: :
    "${fragment}"
    This fragment define a whole new storytelling universe. this description is a mere fragment from a VAST universe. I want to represent this universe
as backside for a virtual RPG deck of card.`
    if(storytellerSession)
    {
        prompt += `here's a short  elaboration on this initial scene taken from a conversation about it:
        ${storytellerSession}`
    }
    prompt += `please based on that knowledge and try to design the backside of this virtual RPG card. (it will be a part of a REACT component with html, and css and the illustration full frame as the visualization of the card)


        the backside of the deck is a texture.
         I want you to define that texture, after analyzing the scene, and finding cultural clues, geographical references that would inspire selection of pallete, motiffs, genres and subgenres
         and also define and examine pivotal terms, names, locations that could help you interpret this scene and set it in a contextual framework.    drawing inspiration from different genres or sub-genres and a range of cultural influences like books, movies, myths, and beyond. This fusion should weave seamlessly, forming a 'new universe' with fresh, yet familiar undertones. but they should all fit into the pivots found in analyzing the scene.
            Articulate the blend clearly, weaving in the details and emotions of the inspirations rather than just naming them. For example: instead of merely stating 'Lovecraft meets Tibetan Thangka', describe how the tentacled abyss might intertwine with sacred gold-outlined designs. remember, it's the backside of the card which is part of a whole deck of cards from this universe. all these backsides are variations on each other.
            the textures are  vague, general, capturing the essence of the universe.
            Use keyword-formatting emphasizing terms like RPG, cinematic, ArtStation, ArtStation winner, grainy, embellishments, flourishes decorative styles, and more.
            consider using abstract, or semi abstract as a key word, if you think the overall description is too concretely based on the existing fragment. you can dare and be archetypal, mythical, symbolical. all the influences should be infused in such a way that we won't be able to trace their origins easily...it should be something new..like this whole new universe made from a fragment...artistic mediums can of course also vary...be creative and adequate. these cards are real physical objects within the game universe. and they're made on a material worn by time, and worn by usage.
    material could be metal, clay, wood, parchment, ivory, stone, and many many more. any object that would make sense to be in a shape of a card...
    these arcane card texture illustrations are going to be used in a react app, so they are part of an html component with css etc. it therefore has to be full frame, unbroken, that can be used as a background illustration for a card, that can be replicated to give an effect of a deck of card. use grainy, natural light atmosphere, so it would make us feel the card actually exists in some imaginary storytelling universe.
            Be exclusively designed for card textures reminiscent of an RPG card's backside. Avoid illustrations or specific scene descriptions.
            Integrate design elements like embellishments, filigree, motifs, flourishes, and ornaments.
            Favor abstract, symbolic, and archetypal designs, and don't shy away from esoteric sub-genres or niche influences, artistic, cultural. even famous tv series, rpg niche genres and settings, artists. movies. I want at least 3 different influences . surprising mixes
            Your provided description will be input for a TextToImage API to generate card texture images, so ensure clarity and detail.
            please provide 4 different variations of textures that could fit to that fragment and add
            a suitable google font for each texture. don't be shy of being esoteric and niche. try to fit the influences for the fragment and the conversation.
            Refrain as much as possible from too concrete influences that can be traced to an earth culture.
            For guidance, consider these examples:
            (these examples don't have mentioning of material and physicality in them)
            'Card texture: Pulling from Brom's art style merged with Dark Sun atmospheres, visualize a desert of sizzling oranges and browns, with distressed edges evoking scorched earth, and the corner embellishments shaped like twisted dragons, high contrast, 8k, RPG essence.'
            'Card texture: Melding Stephan Martinière's vision with A Song of Ice and Fire's chill, picture a detailed silhouette of a castle set against a frosty backdrop, with intricate Northern-inspired knotwork designs accentuating the corners, matte finish for tactile richness, cinematic, grainy, dark fantasy aura, 8k, ArtStation champion.'
            'Card Texture: Generate an 8k texture for a card set in a woodland location. The texture should represent deeper primal energies resonant with The Green Man motifs from pagan cultures. Use earthy greens and rich browns as the primary color scheme. It should have faint, layered patterns resembling bark and moss intermingled with softer swirls and flourishes, reminiscent of a forest at dusk. Make sure to have the frame detailed with intricately interwoven leaves and vines, resonating with mythic undertones, to provide an archetypal RPG aesthetic. Aim for a subtle and immersive design.
            and this more comprehensive example:
            "Create a seamless, FULL FRAME, UNBROKEN inspiring, immersive texture for an RPG card, influenced by the dark fantasy world akin to 'Dark Souls'. The texture should portray a story of endurance and redemption in a mystical, challenging environment. Utilize a color scheme of mossy greens and shadowy greys, interwoven with an ethereal glow symbolizing hope in a realm of despair. Incorporate Shibori dye patterns to add an enigmatic, auroral effect, reminiscent of the mysterious and otherworldly landscapes typical of dark fantasy worlds. Enhance the RPG essence with subtle motifs and symbols reflective of the genre's themes, such as ancient runes or mythical creatures. Frame the design with delicate, card-like embellishments or flourishes that seamlessly integrate with the overall texture. These elements should be inspired by the artistic diversity found in dark fantasy RPG core books and ArtStation, capturing the rich, varied essence of this RPG genre. The texture should avoid any textual elements, embodying the depth and mystical infusion of a dark fantasy RPG world with a focus on blending digital artistry and traditional texture techniques."
            IMPORTANT: THE OUTPUT SHOULD BE A JSON list of objects: [{prompt:String, font:string}] no additional strings. so it won't be broken JSON.parse!!!! '

            also choose real material this card texture is made on in the physical universe of this narrative. example for materials:


            A Weathered card shaped Metal Texture: Create a texture that simulates corroded and tarnished metal, perhaps from ancient armor or relics found in this universe. The metal should have a patina that suggests great age, with embossed designs that are now barely discernible. FULL FRAME. grainy, natural light. cinematic

            Frayed mysterious Card shaped Fabric Texture: Imagine a texture that replicates a piece of frayed fabric, possibly from a banner or garment that has seen better days. The fabric's pattern should be faded and tattered, yet still hinting at the grandeur it once held.

            Each texture should be paired with an appropriate Google font that complements its historical and material qualities, enhancing the overall aesthetic. The textures should maintain an abstract quality to fit various card categories while conveying the wear and tear of time, bringing the players closer to the universe's ancient and mystical atmosphere.

            The design elements should include subtle embellishments, motifs, and flourishes, avoiding direct references to specific Earth cultures. The goal is to create a series of textures that are unique to this RPG universe, blending abstract artistry with the tangible feel of different aged materials.but it's important that they would convey a card like feel and would have a very unique inspiriation for storytelling. will have a storytelling theme to them. it's the theme of the story...there should be at least one concrete element that stands out looking at this card. Also, please emphasize the card like quality of the illustration. the material should make sense as a magical card. make sure to include flourishes and embellishments at the edges to further enhance their card-like quality. MAKE SURE YOU ARE  inspired by niche fantasy novels, RPG games, and movies. make a fusion! mention them in this texture theme creation!

            Output as JSON objects: [{prompt:String, font:string, card_material:Str, major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]},{prompt:String, font:string, card_material:Str, major_cultural_influences_references:[niche rpg system ,
                fantasy/sci fi novel, movie name, artist name]},{prompt:String, font:string, card_material:Str, major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]},{prompt:String, font:string, card_material:Str,major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]}].".
                remember that each item in the list is standalone and will be used on a fresh new instance of dalle-3 without
                any history or knowledge of the original fragment or other textures.
                remember it should be a standalone promtp. without any knowledge of the universe...its details. it's a single prompt for an textToImage api. each entry in the array is a different separated calll. and now having said all that....you can surprise me and add a single defined archteype for each texture.

    Remember that the output should be easily parsed by JSON.parse(), so keep the structre of JSON array as given!            `
    return [{ role: "system", content: prompt }];
}

export function generate_texture_by_fragment_and_conversationGood(fragment){
    const prompt =`look at  the following scene:
    "${fragment}"

I want this scene to define a backside for a virtual RPG set of cards.
this description is a mere fragment from a VAST universe.

the backside of the deck is a texture. I want you to define that texture, after analyzing the scene, and finding cultural clues, pivotal terms, names, locations that could help you interpret this scene and set it in a contextual framework.    drawing inspiration from different genres or sub-genres and a range of cultural influences like books, movies, myths, and beyond. This fusion should weave seamlessly, forming a 'new universe' with fresh, yet familiar undertones. but they should all fit into the pivots found in analyzing the scene.
    Articulate the blend clearly, weaving in the details and emotions of the inspirations rather than just naming them. For example, instead of merely stating 'Lovecraft meets Tibetan Thangka', describe how the tentacled abyss might intertwine with sacred gold-outlined designs. remember, it's the backside of the card which is part of a whole deck of cards from this universe. all these backsides are variations on each other. and they all come in different categories: People, places, items, skills, events...etc.
    it's when the player turning the card that they see what's concretely in on that card. So the textures are more vague, general, capturing the essence of the universe.
    Use keyword-formatting emphasizing terms like RPG, cinematic, ArtStation, ArtStation winner, grainy, embellishments, flourishes decorative styles, and more.
    consider using abstract, or semi abstract as a key word, if you think the overall description is too concretely based on the existing fragment. you can dare and be archetypal, mythical, symbolical
    Be exclusively designed for card textures reminiscent of an RPG card's backside. Avoid illustrations or specific scene descriptions.
    Integrate design elements like embellishments, filigree, motifs, flourishes, and ornaments.
    Favor abstract, symbolic, and archetypal designs, and don't shy away from esoteric sub-genres or niche influences.
    Your provided description will be input for a TextToImage API to generate card texture images, so ensure clarity and detail.

    For guidance, consider these examples:

    'Card texture: Pulling from Brom's art style merged with Dark Sun atmospheres, visualize a desert of sizzling oranges and browns, with distressed edges evoking scorched earth, and the corner embellishments shaped like twisted dragons, high contrast, 8k, RPG essence.'
    'Card texture: Melding Stephan Martinière's vision with A Song of Ice and Fire's chill, picture a detailed silhouette of a castle set against a frosty backdrop, with intricate Northern-inspired knotwork designs accentuating the corners, matte finish for tactile richness, dark fantasy aura, 8k, ArtStation champion.'

    Outputs should be formatted as a JSON list of strings for compatibility with JSON.parse.
    `
    return [{ role: "system", content: prompt }];
}

export function generate_texture_by_fragment_and_conversationOlder(fragment){
    const prompt = `Generate 4 distinctive descriptions for the texture of a card that corresponds to this text fragment taken from a new unfolding story: "${fragment}"
    Each texture description should be interpreting the text fragment in a different way. taking it to a different direction - answering the question which genre or subgenre this fragment can relate to. the direction can be influenced by other related cultural influences, whether it be books, movies, myths etc. but in a surprising various options.
    The textures should have a keyword format, utilizing terms such as RPG, cinematic, ArtStation, ArtStation winner, grainy, embellishments, decorative styles, etc. Note that these descriptions are for the texture of a card, not an illustration. They should provide an engaging aesthetic complement to the story continuation. For example, 'Card texture: Inspired by Brom's art style and Dark Sun, a desert of sizzling oranges and browns, distressed edges give a sense of scorched earth, embellishments of a twisted dragon in the top right, high contrast, 8k, RPG card texture.', 'Card texture: Inspired by Stephan Martinière's art style and A Song of Ice and Fire, a meticulously detailed castle silhouette against a frigid landscape, Northern-inspired knotwork at the corners, the matte finish brings out the texture of the snow, dark fantasy, 8k, ArtStation winner.
    make the card texture subtle and so the influence. tending into more abstract or symbolic. archetypal
    please return the results as a JSON list of strings (so it would not fail on JSON.parse(output) )`
    return [{ role: "system", content: prompt }];
}


export function generate_texture_by_fragment_and_conversationOld(fragment){
    const prompt = `Generate 4 standalone card texture descriptions based on the atmospheric essence captured by the following scene:
    --sceneStart ${fragment} ---sceneEnd
    Each description should:

    Interpret the scene uniquely, drawing inspiration from different genres or sub-genres and a range of cultural influences like books, movies, myths, and beyond. This fusion should weave seamlessly, forming a 'new universe' with fresh, yet familiar undertones.
    Articulate the blend clearly, weaving in the details and emotions of the inspirations rather than just naming them. For example, instead of merely stating 'Lovecraft meets Tibetan Thangka', describe how the tentacled abyss might intertwine with sacred gold-outlined designs.
    Use keyword-formatting emphasizing terms like RPG, cinematic, ArtStation, ArtStation winner, grainy, embellishments, decorative styles, and more.
    Be exclusively designed for card textures reminiscent of an RPG card's backside. Avoid illustrations or specific scene descriptions.
    Integrate design elements like embellishments, filigree, motifs, flourishes, and ornaments.
    Favor abstract, symbolic, and archetypal designs, and don't shy away from esoteric sub-genres or niche influences.
    Your provided description will be input for a TextToImage API to generate card texture images, so ensure clarity and detail.

    For guidance, consider these examples:

    'Card texture: Pulling from Brom's art style merged with Dark Sun atmospheres, visualize a desert of sizzling oranges and browns, with distressed edges evoking scorched earth, and the corner embellishments shaped like twisted dragons, high contrast, 8k, RPG essence.'
    'Card texture: Melding Stephan Martinière's vision with A Song of Ice and Fire's chill, picture a detailed silhouette of a castle set against a frosty backdrop, with intricate Northern-inspired knotwork designs accentuating the corners, matte finish for tactile richness, dark fantasy aura, 8k, ArtStation champion.'

    Outputs should be formatted as a JSON list of strings for compatibility with JSON.parse.
    `
    return [{ role: "system", content: prompt }];
}
