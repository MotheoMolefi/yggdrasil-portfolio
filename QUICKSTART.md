# 🚀 Quick Start Guide

Get your Yggdrasil Portfolio running in 3 steps!

## Step 1: Install Dependencies

```bash
npm install
```

This will install all required packages including:
- React & React DOM
- Three.js and React Three Fiber
- Tailwind CSS
- Framer Motion
- And more...

## Step 2: Customize Your Projects

Edit `src/data/projects.ts` to add your own projects:

```typescript
export const projects: Project[] = [
  {
    id: '1',
    title: 'Your Amazing Project',
    description: 'What makes this project special',
    technologies: ['React', 'TypeScript', 'etc'],
    category: 'web', // Options: 'web', 'mobile', 'ai', 'data', 'other'
    position: [3, 8, 2], // Position on the tree [x, y, z]
    color: '#4a7c59', // Your preferred color
    link: 'https://your-project.com', // Optional
    github: 'https://github.com/you/project', // Optional
  },
  // Add more projects...
];
```

### Positioning Tips:
- **Y-axis (height)**: 3-10 works well (higher = higher on tree)
- **X & Z axes**: -4 to 4 creates nice spread around tree
- Experiment to find positions you like!

## Step 3: Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000 to see your portfolio!

## Customization Ideas

### Change Colors
Edit `tailwind.config.js`:
```javascript
colors: {
  'yggdrasil': {
    'dark': '#yourcolor',
    'bark': '#yourcolor',
    // etc...
  }
}
```

### Adjust Tree Complexity
In `src/components/YggdrasilTree.tsx`, modify:
```typescript
generateBranches([0, trunkHeight, 0], [0, 1, 0], 3, 0.3, 0, 4);
                                                              // ^ Change this number (3-5 recommended)
```

### Camera Settings
In `src/components/Scene.tsx`:
```typescript
<PerspectiveCamera 
  makeDefault 
  position={[0, 8, 20]}  // Adjust starting position
  fov={60}               // Field of view
/>
```

## Building for Production

```bash
npm run build
```

Deploy the `dist/` folder to:
- **Vercel**: `vercel`
- **Netlify**: Drag `dist/` folder to Netlify
- **GitHub Pages**: See README.md for configuration

## Next Steps

1. ✅ Customize your projects
2. ✅ Adjust colors to match your brand
3. ✅ Test on different devices
4. ✅ Deploy to production
5. 🔮 Add Ratatoskr AI (see RATATOSKR_INTEGRATION.md)

## Need Help?

- Check `README.md` for detailed documentation
- Browser console will show any errors
- Ensure you have Node.js v18+ installed

Enjoy your mystical portfolio! 🌳✨

