#!/usr/bin/env python3
"""Film + soundtrack + captions timed from the game's own events => video/out/wick.mp4"""
import json, subprocess, sys
OUT = 'video/out'
events = [json.loads(l) for l in open(f'{OUT}/events.jsonl') if '"at"' in l]
# The render host may reopen the page and replay from 0: keep only the last run.
start = 0
for i in range(1, len(events)):
    if events[i]['at'] < events[i - 1]['at'] - 5:
        start = i
seen = set()
events = [e for e in events[start:] if not ((k := (round(e['at'], 2), e['t'], e.get('who'))) in seen or seen.add(k))]
with open(f'{OUT}/events-final.jsonl', 'w') as f:
    f.writelines(json.dumps(e) + '\n' for e in events)

def first(t, who=None, after=0.0):
    for e in events:
        if e['t'] == t and e['at'] >= after and (who is None or e.get('who') == who):
            return e['at']
    raise SystemExit(f'no event {t} {who} after {after}')

lit = first('lit')
turns = [e['at'] for e in events if e['t'] == 'page-open']
tabs = [e['at'] for e in events if e['t'] == 'album-open'] or []
# Pages in the film: first gap, wall, rain, crow, chasm, pond, today.
end_game = turns[5] if len(turns) > 5 else events[-1]['at']
caps = [
    (0.6, lit - 0.2, 'Sit down. No controllers. Pinch.'),
    (lit + 0.6, lit + 3.6, 'The flame catches. Your real hands cast the shadow.'),
    (first('wait', 'gap'), first('wait', 'gap') + 3.2, 'He stops at the gap and looks at you.'),
    (first('wait', 'gap') + 3.4, first('page-done') - 0.3, 'Your hand is the only road he has.'),
    (first('wait', 'wall', turns[0]), first('wait', 'wall', turns[0]) + 5, 'A wall? Lift him.'),
    (turns[1] + 0.6, turns[1] + 6.5, 'Rain? Hold your hand over him.'),
    (first('awake', 'dog') - 0.2, first('awake', 'dog') + 4.2, 'Old shadow-theatre shapes wake up. The dog sees off the crow.'),
    (first('awake', 'bird') - 0.2, first('awake', 'bird') + 4.5, 'The bird carries him over the chasm.'),
    (first('awake', 'swan') - 0.2, first('awake', 'swan') + 3.6, 'The swan ferries him across the pond.'),
    (first('awake', 'crab') - 0.2, first('awake', 'crab') + 2.6, 'The crab cuts the rope.'),
    (turns[5] + 3, turns[5] + 9, 'Every puppet you find goes in the album.'),
    (turns[5] + 12, turns[5] + 17, 'High-contrast ink mode. Everything works with one hand.'),
    (turns[5] + 17.2, turns[5] + 24, 'After the book, a new page every day, seeded by the date.'),
]
dur = float(sys.argv[1]) if len(sys.argv) > 1 else events[-1]['at'] + 1
CARD = 5.0
fmt = lambda t: f'{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}'
ass = ['[Script Info]', 'PlayResX: 1920', 'PlayResY: 1080', 'ScaledBorderAndShadow: yes', '[V4+ Styles]',
       'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
       'Style: Cap,Georgia,50,&H00E8F4FA,&H0,&H00100A06,&HB0100A06,0,1,0,0,100,100,0,0,4,14,0,8,80,80,34,1',
       'Style: Note,Helvetica,22,&H70E8F4FA,&H0,&H00000000,&H0,0,0,0,0,100,100,0,0,1,1,0,3,30,24,20,1',
       'Style: Title,Georgia,190,&H00C6E2F2,&H0,&H0,&H0,0,0,0,0,100,100,0,0,1,0,0,5,0,0,120,1',
       'Style: Sub,Georgia,54,&H00C6E2F2,&H0,&H0,&H0,0,1,0,0,100,100,0,0,1,0,0,5,0,0,-90,1',
       'Style: Url,Helvetica,30,&H0080B8E8,&H0,&H0,&H0,0,0,0,0,100,100,0,0,1,0,0,5,0,0,-230,1',
       '[Events]', 'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text']
for a, b, t in caps:
    if a < dur:
        ass.append(f'Dialogue: 0,{fmt(a)},{fmt(min(b, dur))},Cap,,0,0,0,,{{\\fad(220,220)}}{t}')
ass.append(f'Dialogue: 0,{fmt(0)},{fmt(dur)},Note,,0,0,0,,Footage from the IWER emulator: scripted hands, stand-in room for passthrough')
total = dur + CARD
ass.append(f'Dialogue: 0,{fmt(dur)},{fmt(total)},Title,,0,0,0,,{{\\fad(500,0)}}Wick')
ass.append(f'Dialogue: 0,{fmt(dur + 0.4)},{fmt(total)},Sub,,0,0,0,,{{\\fad(500,0)}}Your hands cast the only road he has.')
ass.append(f'Dialogue: 0,{fmt(dur + 0.8)},{fmt(total)},Url,,0,0,0,,{{\\fad(500,0)}}designmaster-solutions.github.io/wick')
open(f'{OUT}/captions.ass', 'w').write('\n'.join(ass) + '\n')
subprocess.run(['node', 'video/soundtrack.ts', f'{OUT}/events-final.jsonl', f'{OUT}/soundtrack.wav', str(int(total + 1))], check=True)
vf = f"tpad=stop_mode=clone:stop_duration={CARD},drawbox=enable='gte(t,{dur})':x=0:y=0:w=iw:h=ih:color=0x140b07:t=fill,fade=t=in:st=0:d=0.5,subtitles={OUT}/captions.ass"
af = f"loudnorm=I=-14:TP=-1.5:LRA=20,afade=t=out:st={total - 1.5}:d=1.5"
subprocess.run(['ffmpeg-full', '-y', '-v', 'error', '-t', str(dur), '-i', 'video/film/renders/film.mp4', '-i', f'{OUT}/soundtrack.wav',
                '-filter_complex', f'[0:v]{vf}[v];[1:a]{af}[a]', '-map', '[v]', '-map', '[a]', '-t', str(total),
                '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', f'{OUT}/wick.mp4'], check=True)
print('done', total, 's')
