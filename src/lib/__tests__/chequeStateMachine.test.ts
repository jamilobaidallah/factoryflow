import { CHEQUE_STATUS_AR } from '../constants';
import {
  canTransition,
  canDelete,
  validateTransition,
  validateDeletion,
  getValidTransitions,
  InvalidChequeTransitionError,
  type ChequeStatusValue,
} from '../chequeStateMachine';

describe('Cheque State Machine', () => {
  describe('canTransition', () => {
    describe('from PENDING status', () => {
      const fromStatus = CHEQUE_STATUS_AR.PENDING;

      it('should allow transition to CASHED', () => {
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.CASHED)).toBe(true);
      });

      it('should allow transition to ENDORSED', () => {
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.ENDORSED)).toBe(true);
      });

      it('should allow transition to BOUNCED', () => {
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.BOUNCED)).toBe(true);
      });

      it('should allow transition to RETURNED', () => {
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.RETURNED)).toBe(true);
      });

      it('should allow transition to CANCELLED', () => {
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.CANCELLED)).toBe(true);
      });
    });

    describe('from CASHED status', () => {
      const fromStatus = CHEQUE_STATUS_AR.CASHED;

      it('should allow transition to BOUNCED', () => {
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.BOUNCED)).toBe(true);
      });

      it('should allow transition to RETURNED', () => {
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.RETURNED)).toBe(true);
      });

      it('should allow transition back to PENDING (reversal)', () => {
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.PENDING)).toBe(true);
      });

      it('should NOT allow transition to ENDORSED', () => {
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.ENDORSED)).toBe(false);
      });
    });

    describe('from ENDORSED status (terminal)', () => {
      const fromStatus = CHEQUE_STATUS_AR.ENDORSED;

      it('should NOT allow transition to CASHED', () => {
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.CASHED)).toBe(false);
      });

      it('should NOT allow transition to BOUNCED', () => {
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.BOUNCED)).toBe(false);
      });

      it('should NOT allow transition to PENDING', () => {
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.PENDING)).toBe(false);
      });
    });

    describe('from BOUNCED status (terminal)', () => {
      const fromStatus = CHEQUE_STATUS_AR.BOUNCED;

      it('should NOT allow transition to CASHED', () => {
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.CASHED)).toBe(false);
      });

      it('should NOT allow transition to ENDORSED', () => {
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.ENDORSED)).toBe(false);
      });

      it('should NOT allow transition to PENDING', () => {
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.PENDING)).toBe(false);
      });
    });

    describe('from RETURNED status (terminal)', () => {
      const fromStatus = CHEQUE_STATUS_AR.RETURNED;

      it('should NOT allow any transitions', () => {
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.CASHED)).toBe(false);
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.ENDORSED)).toBe(false);
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.PENDING)).toBe(false);
      });
    });

    describe('from CANCELLED status (terminal)', () => {
      const fromStatus = CHEQUE_STATUS_AR.CANCELLED;

      it('should NOT allow any transitions', () => {
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.CASHED)).toBe(false);
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.ENDORSED)).toBe(false);
        expect(canTransition(fromStatus, CHEQUE_STATUS_AR.PENDING)).toBe(false);
      });
    });

    it('should return false for unknown status', () => {
      expect(canTransition('unknown_status' as ChequeStatusValue, CHEQUE_STATUS_AR.CASHED)).toBe(false);
    });
  });

  describe('canDelete', () => {
    it('should allow deletion of PENDING cheques', () => {
      expect(canDelete(CHEQUE_STATUS_AR.PENDING)).toBe(true);
    });

    it('should NOT allow deletion of CASHED cheques', () => {
      expect(canDelete(CHEQUE_STATUS_AR.CASHED)).toBe(false);
    });

    it('should NOT allow deletion of ENDORSED cheques', () => {
      expect(canDelete(CHEQUE_STATUS_AR.ENDORSED)).toBe(false);
    });

    it('should NOT allow deletion of BOUNCED cheques', () => {
      expect(canDelete(CHEQUE_STATUS_AR.BOUNCED)).toBe(false);
    });

    it('should NOT allow deletion of RETURNED cheques', () => {
      expect(canDelete(CHEQUE_STATUS_AR.RETURNED)).toBe(false);
    });

    it('should NOT allow deletion of CANCELLED cheques', () => {
      expect(canDelete(CHEQUE_STATUS_AR.CANCELLED)).toBe(false);
    });

    it('should return false for unknown status', () => {
      expect(canDelete('unknown_status' as ChequeStatusValue)).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('should not throw for valid transition', () => {
      expect(() => {
        validateTransition(CHEQUE_STATUS_AR.PENDING, CHEQUE_STATUS_AR.CASHED);
      }).not.toThrow();
    });

    it('should throw InvalidChequeTransitionError for invalid transition', () => {
      expect(() => {
        validateTransition(CHEQUE_STATUS_AR.CASHED, CHEQUE_STATUS_AR.ENDORSED);
      }).toThrow(InvalidChequeTransitionError);
    });

    it('should include meaningful error message in Arabic', () => {
      try {
        validateTransition(CHEQUE_STATUS_AR.ENDORSED, CHEQUE_STATUS_AR.CASHED);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidChequeTransitionError);
        if (error instanceof InvalidChequeTransitionError) {
          expect(error.message).toContain('لا يمكن تغيير حالة الشيك');
          expect(error.fromStatus).toBe(CHEQUE_STATUS_AR.ENDORSED);
          expect(error.toStatus).toBe(CHEQUE_STATUS_AR.CASHED);
        }
      }
    });
  });

  describe('validateDeletion', () => {
    it('should not throw for PENDING cheque', () => {
      expect(() => {
        validateDeletion(CHEQUE_STATUS_AR.PENDING);
      }).not.toThrow();
    });

    it('should throw InvalidChequeTransitionError for non-deletable cheque', () => {
      expect(() => {
        validateDeletion(CHEQUE_STATUS_AR.ENDORSED);
      }).toThrow(InvalidChequeTransitionError);
    });

    it('should throw for CASHED cheque', () => {
      expect(() => {
        validateDeletion(CHEQUE_STATUS_AR.CASHED);
      }).toThrow(InvalidChequeTransitionError);
    });
  });

  describe('getValidTransitions', () => {
    it('should return valid transitions for PENDING', () => {
      const transitions = getValidTransitions(CHEQUE_STATUS_AR.PENDING);
      expect(transitions).toContain(CHEQUE_STATUS_AR.CASHED);
      expect(transitions).toContain(CHEQUE_STATUS_AR.ENDORSED);
      expect(transitions).toContain(CHEQUE_STATUS_AR.BOUNCED);
    });

    it('should return valid transitions for CASHED', () => {
      const transitions = getValidTransitions(CHEQUE_STATUS_AR.CASHED);
      expect(transitions).toContain(CHEQUE_STATUS_AR.BOUNCED);
      expect(transitions).toContain(CHEQUE_STATUS_AR.RETURNED);
      expect(transitions).not.toContain(CHEQUE_STATUS_AR.ENDORSED);
    });

    it('should return empty array for terminal states', () => {
      expect(getValidTransitions(CHEQUE_STATUS_AR.ENDORSED)).toHaveLength(0);
      expect(getValidTransitions(CHEQUE_STATUS_AR.BOUNCED)).toHaveLength(0);
      expect(getValidTransitions(CHEQUE_STATUS_AR.RETURNED)).toHaveLength(0);
    });

    it('should not include DELETED pseudo-state in results', () => {
      const transitions = getValidTransitions(CHEQUE_STATUS_AR.PENDING);
      expect(transitions).not.toContain('__DELETED__');
    });
  });

  describe('InvalidChequeTransitionError', () => {
    it('should have correct name', () => {
      const error = new InvalidChequeTransitionError(
        CHEQUE_STATUS_AR.CASHED,
        CHEQUE_STATUS_AR.ENDORSED
      );
      expect(error.name).toBe('InvalidChequeTransitionError');
    });

    it('should store from and to status', () => {
      const error = new InvalidChequeTransitionError(
        CHEQUE_STATUS_AR.BOUNCED,
        CHEQUE_STATUS_AR.CASHED
      );
      expect(error.fromStatus).toBe(CHEQUE_STATUS_AR.BOUNCED);
      expect(error.toStatus).toBe(CHEQUE_STATUS_AR.CASHED);
    });

    it('should be instanceof Error', () => {
      const error = new InvalidChequeTransitionError(
        CHEQUE_STATUS_AR.PENDING,
        CHEQUE_STATUS_AR.CASHED
      );
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('Business Rule Validation', () => {
    it('should prevent cashing an already endorsed cheque', () => {
      // Business rule: Once a cheque is endorsed (transferred), you can't cash it
      expect(canTransition(CHEQUE_STATUS_AR.ENDORSED, CHEQUE_STATUS_AR.CASHED)).toBe(false);
    });

    it('should prevent endorsing an already cashed cheque', () => {
      // Business rule: Once you've received money for a cheque, you can't transfer it
      expect(canTransition(CHEQUE_STATUS_AR.CASHED, CHEQUE_STATUS_AR.ENDORSED)).toBe(false);
    });

    it('should prevent re-cashing a bounced cheque', () => {
      // Business rule: A bounced cheque cannot be cashed again
      expect(canTransition(CHEQUE_STATUS_AR.BOUNCED, CHEQUE_STATUS_AR.CASHED)).toBe(false);
    });

    it('should allow bouncing a cheque that was cashed', () => {
      // Business rule: A cheque can bounce after being cashed (bank reversal)
      expect(canTransition(CHEQUE_STATUS_AR.CASHED, CHEQUE_STATUS_AR.BOUNCED)).toBe(true);
    });

    it('should prevent modifying an endorsed cheque', () => {
      // Business rule: Endorsed cheques cannot be modified (terminal state)
      const transitions = getValidTransitions(CHEQUE_STATUS_AR.ENDORSED);
      expect(transitions).toHaveLength(0);
    });
  });
});
