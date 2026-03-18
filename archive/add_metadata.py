#!/usr/bin/env python3
"""
Script to add grading metadata to examData.ts
This ensures all quotes are properly escaped and types are correct.
"""

# Question IDs that should be marked as 'conceptual' with their concepts
CONCEPTUAL_QUESTIONS = {
    # BARTENDER_KEY
    'b16': {
        'concepts': ['chill/dilute the drink', 'citrus juice or egg white or cream'],
        'minimum': 1
    },
    
    # SERVER_KEY  
    's1': {
        'concepts': ['guests', 'employees', 'owners'],
        'minimum': 2
    },
    's2': {
        'concepts': ['company shirt/polo', 'dark jeans without holes', 'black non-slip shoes', 'neat and clean appearance'],
        'minimum': 3
    },
    's5': {
        'concepts': ['suggest additional items or upgrades', 'mention specials or promotions', 'increase check average'],
        'minimum': 1
    },
    's6': {
        'concepts': ['stay calm/relaxed', 'maintain control', 'notify kitchen/bar immediately', 'inform manager'],
        'minimum': 2
    },
    's7': {
        'concepts': ['dirty plates', 'idle servers in groups', 'ignoring guests', 'negative attitude'],
        'minimum': 2
    },
    's8': {
        'concepts': ['energetic/friendly attitude', 'caring demeanor', 'professional and confident'],
        'minimum': 2
    },
    's9': {
        'concepts': ['clear used/empty items', 'before guests finish meal', 'keep table tidy', 'make space for next course'],
        'minimum': 2
    },
    
    # HOST_KEY
    'h6': {
        'concepts': ['complete contact form or email', 'over 20 guests = event', 'directed to management'],
        'minimum': 2
    },
    'h8': {
        'concepts': ['pre-bussing = remove items while dining', 'maintain clean appearance', 'post-dining = clean and reset', 'after guests leave'],
        'minimum': 3
    },
    'h9': {
        'concepts': ['manage flow of guests', 'ensure timely service', 'accept walk-ins', 'reservation guarantees table at preferred time'],
        'minimum': 2
    },
    'h11': {
        'concepts': ['check Resy availability', 'update party size if possible', 'politely inform if cannot guarantee', 'try our best'],
        'minimum': 2
    },
    'h12': {
        'concepts': ['greet warmly', 'inform wait time', 'add to waitlist', 'suggest bar area or text when ready'],
        'minimum': 3
    },
    'h13': {
        'concepts': ['remain calm', 'apologize for delay', 'explain situation honestly', 'offer gesture of hospitality or updates'],
        'minimum': 3
    },
    'h14': {
        'concepts': ['verify reservation details', 'identify actual reservation holder', 'apologize to other party', 'accommodate as priority walk-in'],
        'minimum': 3
    },
    'h15': {
        'concepts': ['warm greeting', 'ask date/time/party size', 'check availability', 'collect name and phone', 'inquire about special occasions', 'repeat details back', 'thank them'],
        'minimum': 4
    },
    
    # OAK_SERVER_KEY
    'os-5': {
        'concepts': ['present bottle to host with label', 'announce producer/vintage/varietal/region', 'cut foil and wipe neck', 'insert corkscrew and remove cork', 'pour taste for host approval', 'serve clockwise ladies first', 'fill one-third full'],
        'minimum': 5
    },
    'os-6': {
        'concepts': ['suggest premium brands', 'offer double option', 'use question format'],
        'minimum': 2
    },
    
    # CANTINA_HOST_KEY
    'ch-5': {
        'concepts': ['closed-toe shoes', 'polished/professional look', 'fitted elegant attire', 'excellent condition', 'no writing/logos unless official'],
        'minimum': 3
    },
    
    # CANTINA_SERVER_KEY
    'cs-3': {
        'concepts': ['ask preference or what they like', 'offer premium options', 'suggest flavorful twist or signature', 'offer double'],
        'minimum': 2
    }
}

def add_metadata_to_line(line, question_id):
    """Add grading metadata to a question line."""
    # Skip if already has metadata
    if 'gradingType' in line:
        return line
    
    # Find the end of the line (before the closing },)
    if line.rstrip().endswith('},'):
        line = line.rstrip()[:-2]  # Remove },
        
        if question_id in CONCEPTUAL_QUESTIONS:
            # Add conceptual metadata
            concepts = CONCEPTUAL_QUESTIONS[question_id]['concepts']
            minimum = CONCEPTUAL_QUESTIONS[question_id]['minimum']
            concepts_str = str(concepts).replace("'", "\\'")
            line += f", gradingType: 'conceptual' as const, requiredConcepts: {concepts_str}, minimumConcepts: {minimum}"
        else:
            # Add factual metadata
            line += ", gradingType: 'factual' as const"
        
        line += " },"
    
    return line + '\n' if not line.endswith('\n') else line

def main():
    import re
    
    # Read the file
    with open('data/examData.ts', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Process each line
    new_lines = []
    for line in lines:
        # Look for question IDs in format { id: 'xxx', ...
        match = re.search(r"id:\s*'([^']+)'", line)
        if match:
            question_id = match.group(1)
            line = add_metadata_to_line(line, question_id)
        
        new_lines.append(line)
    
    # Write back
    with open('data/examData.ts', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    print("✅ Metadata added successfully!")
    print(f"✅ {len(CONCEPTUAL_QUESTIONS)} conceptual questions enhanced")
    print(f"✅ All remaining questions marked as factual")

if __name__ == '__main__':
    main()
