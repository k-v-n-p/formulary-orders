import { Injectable } from '@angular/core';
import { Engine, Operator } from 'json-rules-engine';
import { BehaviorSubject, Observable } from 'rxjs';
import { QuestionnaireManagerService } from './questionnaire-manager.service';

// Define interfaces for our rule structure
interface RuleCondition {
  fact: string;
  path: string;
  operator: string;
  value: any;
}

interface RuleEvent {
  type: string;
  params: {
    [key: string]: any;
  };
}

interface Rule {
  conditions: {
    all?: RuleCondition[];
    any?: Array<{all: RuleCondition[]}>;
  };
  event: RuleEvent;
}

// Question option interface
export interface QuestionOption {
  value: string;
  label: string;
}

// Validation rules interface
export interface ValidationRules {
  min?: number;
  max?: number;
  maxLength?: number;
  required?: boolean;
  pattern?: string;
}

export interface Question {
  id: string;
  text: string;
  type: string; // Use string instead of union type to match JSON
  required: boolean;
  visible: boolean;
  answered?: boolean;
  answer?: any;
  options?: QuestionOption[];
  validations?: ValidationRules;
}

export interface CoverageWarning {
  id: string;
  message: string;
  level: string; // Use string instead of union type to match JSON
  visible: boolean;
  questionId?: string; // Associated question ID
}

interface QuestionFacts {
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class RulesService {
  private engine: Engine;
  private questions: Question[] = [];
  private coverageWarnings: CoverageWarning[] = [];
  
  private questionsSubject = new BehaviorSubject<Question[]>([]);
  private warningsSubject = new BehaviorSubject<CoverageWarning[]>([]);
  
  constructor(private questionnaireManager: QuestionnaireManagerService) {
    this.engine = new Engine();
    this.addCustomOperators();
    
    // Listen for questionnaire changes
    this.questionnaireManager.getQuestionnaireData().subscribe(data => {
      if (data) {
        this.initializeQuestionsFromData(data.questions, data.coverageWarnings);
      }
    });
    
    // Listen for rule changes
    this.questionnaireManager.getRules().subscribe(rules => {
      if (rules && rules.length) {
        this.initializeRules(rules);
      }
    });
  }
  
  private addCustomOperators(): void {
    // Add the 'contains' operator for arrays
    const containsOperator = new Operator('contains', (factValue, jsonValue) => {
      if (Array.isArray(factValue)) {
        return factValue.includes(jsonValue);
      }
      // If the fact value is a string, check if it contains the jsonValue
      if (typeof factValue === 'string' && typeof jsonValue === 'string') {
        return factValue.toLowerCase().includes(jsonValue.toLowerCase());
      }
      return false;
    });
    
    // Add case-insensitive equal operator
    const equalOperator = new Operator('equal', (factValue, jsonValue) => {
      if (typeof factValue === 'string' && typeof jsonValue === 'string') {
        return factValue.toLowerCase() === jsonValue.toLowerCase();
      }
      return factValue === jsonValue;
    });
    
    this.engine.addOperator(containsOperator);
    this.engine.addOperator(equalOperator);
  }
  
  private initializeRules(rules: any[]): void {
    // Reset the engine
    this.engine = new Engine();
    this.addCustomOperators();
    
    // Add rules from the provided array
    rules.forEach((rule: any) => this.engine.addRule(rule));
    
    // After initializing rules, evaluate them
    if (this.questions.length > 0) {
      this.evaluateRules();
    }
  }
  
  private initializeQuestionsFromData(questions: any[], warnings: any[]): void {
    this.questions = questions.map(q => ({
      ...q,
      answered: false
    }));
    
    this.coverageWarnings = warnings;
    
    this.questionsSubject.next([...this.questions]);
    this.warningsSubject.next([...this.coverageWarnings]);
    
    // After initializing, evaluate rules
    this.evaluateRules();
  }
  
  getQuestions(): Observable<Question[]> {
    return this.questionsSubject.asObservable();
  }
  
  getCoverageWarnings(): Observable<CoverageWarning[]> {
    return this.warningsSubject.asObservable();
  }
  
  resetQuestionnaire(): void {
    // Reset all question answers and visibility to their initial states
    this.questions.forEach(question => {
      question.answer = undefined;
      question.answered = false;
    });
    
    // Reset all warnings
    this.coverageWarnings.forEach(warning => {
      warning.visible = false;
    });
    
    // Re-evaluate rules
    this.evaluateRules();
    
    // Notify subscribers
    this.questionsSubject.next([...this.questions]);
    this.warningsSubject.next([...this.coverageWarnings]);
  }
  
  answerQuestion(questionId: string, answer: any): void {
    const questionIndex = this.questions.findIndex(q => q.id === questionId);
    if (questionIndex >= 0) {
      this.questions[questionIndex].answer = answer;
      this.questions[questionIndex].answered = true;
      
      // Run the rules engine with the updated answers
      this.evaluateRules();
      
      // Update subscribers
      this.questionsSubject.next([...this.questions]);
      this.warningsSubject.next([...this.coverageWarnings]);
    }
  }
  
  updateAnswers(answers: {id: string, answer: any}[]): void {
    let updated = false;
    
    answers.forEach(item => {
      const questionIndex = this.questions.findIndex(q => q.id === item.id);
      if (questionIndex >= 0) {
        this.questions[questionIndex].answer = item.answer;
        this.questions[questionIndex].answered = true;
        updated = true;
      }
    });
    
    if (updated) {
      // Run the rules engine with the updated answers
      this.evaluateRules();
      
      // Update subscribers
      this.questionsSubject.next([...this.questions]);
      this.warningsSubject.next([...this.coverageWarnings]);
    }
  }
  
  private evaluateRules(): void {
    // Create fact object from question answers
    const facts = {
      question: this.questions.reduce((obj: QuestionFacts, q) => {
        obj[q.id] = q.answer;
        return obj;
      }, {})
    };
    
    // Reset visibility for dynamic questions and warnings
    this.resetDynamicQuestionVisibility();
    this.resetWarningVisibility();
    
    // Run the rules engine
    this.engine.run(facts).then(({ events }) => {
      events.forEach(event => {
        if (event.type === 'showQuestions' && event.params) {
          // Handle showing questions
          const questionIds = event.params?.['questions'];
          if (Array.isArray(questionIds)) {
            questionIds.forEach(id => {
              const questionIndex = this.questions.findIndex(q => q.id === id);
              if (questionIndex >= 0) {
                this.questions[questionIndex].visible = true;
              }
            });
          }
        } else if (event.type === 'coverageWarning' && event.params) {
          // Handle showing warnings
          const warningId = event.params?.['warningId'];
          const questionId = event.params?.['questionId']; // Get associated questionId if available
          
          if (warningId) {
            const warningIndex = this.coverageWarnings.findIndex(
              w => w.id === warningId
            );
            if (warningIndex >= 0) {
              this.coverageWarnings[warningIndex].visible = true;
              
              // Store associated questionId if provided
              if (questionId) {
                this.coverageWarnings[warningIndex].questionId = questionId;
              }
            }
          }
        }
      });
    });
  }

  private resetDynamicQuestionVisibility(): void {
    // Reset visibility for questions that aren't initially visible based on data
    this.questionnaireManager.getQuestionnaireData().subscribe(data => {
      if (data) {
        this.questions.forEach((question, index) => {
          const originalQuestion = data.questions.find(q => q.id === question.id);
          if (originalQuestion && !originalQuestion.visible) {
            question.visible = false;
          }
        });
      }
    });
  }

  private resetWarningVisibility(): void {
    // Reset all warnings to hidden
    this.coverageWarnings.forEach(warning => warning.visible = false);
  }
}
