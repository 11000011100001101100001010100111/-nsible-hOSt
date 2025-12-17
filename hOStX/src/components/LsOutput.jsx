
import React from 'react';

const LsOutput = ({ items, path }) => {
  return (
    <div>
      <p className="themed-text-primary mb-1">Directory: {path}</p>
      {items.length === 0 ? (
        <p className="themed-text-secondary">Directory is empty.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1">
          {items.map((item, index) => (
            <p
              key={index}
              className={item.type === 'folder' ? 'text-yellow-500 font-bold' : 'text-blue-400'}
            >
              {item.name}
              {item.type === 'folder' && '/'}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export default LsOutput;
