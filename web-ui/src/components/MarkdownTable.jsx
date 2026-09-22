import './MarkdownTable.css';

function Table({ node: _node, className = '', ...props }) {
  return <table {...props} className={`markdown-table ${className}`.trim()} />;
}

export const markdownTableComponents = {
  table: Table,
};
