interface WorkspaceViewProps {
  onOpenProject?: () => void;
}

const WorkspaceView: React.FC<WorkspaceViewProps> = ({ onOpenProject }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-background text-gray-500 p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-bold text-foreground">Welcome to Wand</h1>
        <p className="text-lg">
          Your all-purpose AI assistant for coding, writing, and planning.
        </p>
        
        <div className="grid grid-cols-2 gap-4 mt-8">
          <div 
            onClick={onOpenProject}
            className="p-6 border border-accent rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer text-left"
          >
            <h3 className="text-foreground font-medium mb-2">Open Project</h3>
            <p className="text-sm">Start a new coding project or document workspace.</p>
          </div>
          <div 
            onClick={() => alert('Connect Tools clicked!')}
            className="p-6 border border-accent rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer text-left"
          >
            <h3 className="text-foreground font-medium mb-2">Connect Tools</h3>
            <p className="text-sm">Integrate with GitHub, Notion, Slack, and more.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceView;
