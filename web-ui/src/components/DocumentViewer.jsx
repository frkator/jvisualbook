import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from "remark-gfm";
import { fetchChapterDocument, postCode } from '../services/api';
import MonacoEditorWrapper from './MonacoEditor';
import SlideViewer from './SlideViewer';
import { printSlidesAsPDF } from './PrintSlides';
import { markdownTableComponents } from './MarkdownTable';
import { markdownRehypePlugins, markdownUrlTransform } from '../markdownPlugins';
import './DocumentViewer.css';

function assignUUID(doc) {
  return {
    sections: doc.sections.map(section => ({
      ...section,
      contents: section.contents.map(content => ({
        ...content,
        id: crypto.randomUUID()
      }))
    }))
  };
}

function getCodeBlocks(doc) {
  return doc.sections.flatMap(section =>
    section.contents
      .filter(content => content.kind === "CODE")
      .map(content => content.text)
  );
}

function mergeDocument(doc, execution) {
  let count = 0;
  return {
    sections: doc.sections.map(section => {
      const newContents = [];
      section.contents.forEach(content => {
        if (content.kind === "OUTPUT") {
          return; // Skip old output
        }
        newContents.push(content);
        if (content.kind === "CODE") {
          const evaluation = execution.evaluations[count++];
          newContents.push({
            kind: "OUTPUT",
            text: evaluation.text,
            id: content.id + "-output",
            status: evaluation.status,
          });
        }
      });
      return { ...section, contents: newContents };
    })
  };
}

function DocumentViewer({ chapterName }) {
  const [loadedDocument, setLoadedDocument] = useState(null);
  const [displayDocument, setDisplayDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [slideMode, setSlideMode] = useState(false);
  const [executing, setExecuting] = useState(false);
  const codeAbortController = useRef(null);
  const exitSlideMode = useCallback(() => setSlideMode(false), []);

  const loadDocument = async () => {
    setLoading(true);
    setError(null);
    setDisplayDocument(null);
    try {
      const doc = await fetchChapterDocument(chapterName);
      setLoadedDocument(assignUUID(doc));
    } catch (err) {
      setError('Failed to load document');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const runCode = async (doc) => {
    codeAbortController.current?.abort();
    const controller = new AbortController();
    codeAbortController.current = controller;
    setExecuting(true);

    const codeBlocks = getCodeBlocks(doc);
    const program = {
      snippets: codeBlocks.map(text => ({ code: text }))
    };
    try {
      const execution = await postCode(program, controller.signal);
      setDisplayDocument(mergeDocument(doc, execution));
    } catch (err) {
      if (err.name === 'AbortError') return;  // postCode() is aborted
      setError('Failed to run document');
      console.error(err);
    } finally {
      // An older request must not clear a newer request's busy indicator.
      if (codeAbortController.current === controller) {
        codeAbortController.current = null;
        setExecuting(false);
      }
    }
  };

  const handleCodeChange = (contentId, newValue) => {
    codeAbortController.current?.abort();
    setLoadedDocument(doc => ({
      sections: doc.sections.map(section => ({
        ...section,
        contents: section.contents.map(content => {
          if (content.id !== contentId) return content;
          return { ...content, text: newValue };
        })
      }))
    }));
  };

  const renderContent = content => {
    if (content.kind === "TEXT") {
      return (
        <div key={content.id} className="text-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={markdownRehypePlugins} urlTransform={markdownUrlTransform} components={markdownTableComponents}>
            {content.text}
          </ReactMarkdown>
        </div>
      );
    }
    if (content.kind === "CODE") {
      return (
        <div key={content.id}>
          <pre className="editor-text">{content.text}</pre>
          <MonacoEditorWrapper
            code={content.text}
            onChange={val => handleCodeChange(content.id, val)}
          />
        </div>
      );
    }
    if (content.kind === "OUTPUT") {
      const text = content.text;
      const status = content.status === "ERROR" ? "status-error" : "";
      return text && (
        <pre key={content.id} className={`text-output ${status}`}>{text}</pre>
      );
    }
  };

  useEffect(() => {
    fetchChapterDocument(chapterName)
      .then(doc => {
        setLoadedDocument(assignUUID(doc));
      })
      .catch(err => {
        setError('Failed to load document');
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [chapterName]);

  useEffect(() => {
    if (!loadedDocument) return;
    const timer = setTimeout(async () => {
      await runCode(loadedDocument);
    }, 500);
    return () => clearTimeout(timer);
  }, [loadedDocument]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={loadDocument}>Retry</button>
      </div>
    );
  }

  const docToRender = displayDocument ?? loadedDocument;
  if (!docToRender?.sections) {
    return <div className="error-container">No document found</div>;
  }

  const executionIndicator = executing ? (
    <div className="execution-indicator" role="status">
      <span>Evaluating Java...</span>
      <progress aria-label="Waiting for Java evaluation" />
    </div>
  ) : null;

  if (slideMode) {
    return (
      <>
        {executionIndicator}
        <SlideViewer
          doc={docToRender}
          onExit={exitSlideMode}
          renderContent={renderContent}
        />
      </>
    );
  }

  return (
    <div className="document-viewer">
      {executionIndicator}
      <div className="document-toolbar">
        <h2 className="chapter-title">Chapter: {chapterName}</h2>
        <div className="toolbar-actions">
          <button className="toggle-code-btn" onClick={() => setSlideMode(true)}>
            Slide Mode
          </button>
          <button className="toggle-code-btn" onClick={() => printSlidesAsPDF(docToRender)}>
            Print Slides
          </button>
          <button className="toggle-code-btn" onClick={loadDocument}>
            Reload
          </button>
        </div>
      </div>

      <div className="document-content">
        {docToRender.sections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="section">
            <div className="section-title">
              <ReactMarkdown rehypePlugins={markdownRehypePlugins} urlTransform={markdownUrlTransform}>
                {section.title}
              </ReactMarkdown>
            </div>
            <br/>
            <div className="section-contents">
              {section.contents.map(content =>
                renderContent(content)
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DocumentViewer;
